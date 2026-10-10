import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { brotliDecompressSync, gunzipSync, inflateSync } from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { sendJson, sendMessage, sendText } from './claude-skill-preload-protocol.ts';

export interface Checks {
  agentToolExposed: boolean;
  childRequestObserved: boolean;
  childResultReturnedToParent: boolean;
  childToolsPresent: boolean;
  editToolUnavailable: boolean;
  globalRulesPreloaded: boolean;
  reviewerAgentDispatched: boolean;
  reviewerSkillPreloaded: boolean;
  wrapperLoaded: boolean;
  writeToolUnavailable: boolean;
}

export interface RuntimeState {
  checks: Checks;
  contextDigests: Record<string, string>;
  diagnostics: RequestDiagnostic[];
  failureCode: string | null;
  phase: 'awaiting-parent' | 'awaiting-child' | 'awaiting-parent-result' | 'finished';
}

export interface RequestDiagnostic {
  bodyByteCount: number;
  contentEncoding: string;
  contentType: string;
  method: string;
  path: string;
}

export interface Evidence {
  checks: Checks;
  cliVersion: string;
  contextDigests: Record<string, string>;
  diagnostics: RequestDiagnostic[];
  failureCode: string | null;
  status: 'passed' | 'failed';
}

export interface PreloadFixture {
  port: number;
  state: RuntimeState;
  stop: () => Promise<void>;
}

const packageRoot = path.resolve(import.meta.dirname, '../../packages/agent-plugins/plugin');
const fixtureStopText = 'CLAUDE_PRELOAD_FIXTURE_STOP';
const childResultText = 'CLAUDE_PRELOAD_CHILD_RESULT';
const parentResultText = 'CLAUDE_PRELOAD_PARENT_RESULT';
const requestLimitBytes = 8 * 1024 * 1024;
const diagnosticLimit = 5;

const initialChecks = (): Checks => ({
  agentToolExposed: false,
  childRequestObserved: false,
  childResultReturnedToParent: false,
  childToolsPresent: false,
  editToolUnavailable: false,
  globalRulesPreloaded: false,
  reviewerAgentDispatched: false,
  reviewerSkillPreloaded: false,
  wrapperLoaded: false,
  writeToolUnavailable: false,
});

export const createPreloadState = (): RuntimeState => ({
  checks: initialChecks(),
  contextDigests: {},
  diagnostics: [],
  failureCode: null,
  phase: 'awaiting-parent',
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const sha256 = (value: string): string => createHash('sha256').update(value, 'utf-8').digest('hex');

const normalizeText = (value: string, temporaryRoot: string): string =>
  value.replaceAll('\r\n', '\n').split(temporaryRoot).join('<TMP>');

const readSkillBody = (relativePath: string): string => {
  const text = fs.readFileSync(path.join(packageRoot, relativePath), 'utf-8');
  const match = /^---\r?\n[\s\S]*?\r?\n---\r?\n(?<body>[\s\S]*)$/u.exec(text);
  const body = match?.groups?.body;
  if (body === undefined) {
    throw new Error('required-skill-frontmatter-invalid');
  }
  return body.replace(/^<!-- Auto-generated[\s\S]*?-->\s*/u, '').trim();
};

const collectText = (value: unknown): string[] => {
  if (typeof value === 'string') {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(collectText);
  }
  if (isRecord(value)) {
    return Object.values(value).flatMap(collectText);
  }
  return [];
};

const readRequest = async (
  request: IncomingMessage,
  diagnostic: RequestDiagnostic,
): Promise<Buffer> => {
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > requestLimitBytes) {
      request.destroy();
      throw new Error('request-too-large');
    }
    diagnostic.bodyByteCount = size;
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
};

const decodeRequestBody = (body: Buffer, contentEncoding: string): Buffer => {
  const codings = contentEncoding
    .split(',')
    .map((coding) => coding.trim())
    .filter((coding) => coding !== '' && coding !== 'identity')
    .toReversed();
  let decoded = body;
  for (const coding of codings) {
    if (!['gzip', 'br', 'deflate'].includes(coding)) {
      throw new Error('unsupported-content-encoding');
    }
    try {
      if (coding === 'gzip') {
        decoded = gunzipSync(decoded);
      } else if (coding === 'br') {
        decoded = brotliDecompressSync(decoded);
      } else {
        decoded = inflateSync(decoded);
      }
    } catch {
      throw new Error('request-decompression-failed');
    }
  }
  return decoded;
};

const parseRequest = (body: Buffer, contentEncoding: string): Record<string, unknown> => {
  const decoded = decodeRequestBody(body, contentEncoding);
  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded.toString('utf-8'));
  } catch {
    throw new Error('request-json-invalid');
  }
  if (!isRecord(parsed)) {
    throw new Error('request-json-invalid');
  }
  return parsed;
};

const requiredValue = (definition: Record<string, unknown>): unknown => {
  const enumValue = Array.isArray(definition.enum)
    ? definition.enum.find((value) => typeof value === 'string')
    : undefined;
  if (typeof enumValue === 'string') {
    return enumValue;
  }
  if (definition.type === 'string') {
    return 'preload probe';
  }
  if (definition.type === 'boolean') {
    return false;
  }
  if (definition.type === 'number' || definition.type === 'integer') {
    return 1;
  }
  if (definition.type === 'array') {
    return [];
  }
  if (definition.type === 'object') {
    return {};
  }
  return undefined;
};

const agentInput = (
  requestBody: Record<string, unknown>,
): { input: Record<string, unknown>; name: string } | undefined => {
  if (!Array.isArray(requestBody.tools)) {
    return undefined;
  }
  for (const tool of requestBody.tools) {
    if (
      !isRecord(tool) ||
      typeof tool.name !== 'string' ||
      !['Agent', 'Task'].includes(tool.name) ||
      !isRecord(tool.input_schema)
    ) {
      continue;
    }
    const properties = isRecord(tool.input_schema.properties) ? tool.input_schema.properties : {};
    if (!('subagent_type' in properties)) {
      continue;
    }
    const input: Record<string, unknown> = {
      description: 'Check the reviewer skill preload',
      prompt: 'Return the one-line result CLAUDE_PRELOAD_CHILD_RESULT.',
      subagent_type: 'maestria:reviewer',
    };
    const required = Array.isArray(tool.input_schema.required) ? tool.input_schema.required : [];
    for (const field of required) {
      if (typeof field !== 'string' || field in input) {
        continue;
      }
      const definition = properties[field];
      if (!isRecord(definition)) {
        return undefined;
      }
      const value = requiredValue(definition);
      if (value === undefined) {
        return undefined;
      }
      input[field] = value;
    }
    return { input, name: tool.name };
  }
  return undefined;
};

const readToolNames = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.flatMap((tool) => (isRecord(tool) && typeof tool.name === 'string' ? [tool.name] : []))
    : [];

export const setFailure = (state: RuntimeState, code: string): void => {
  state.failureCode ??= code;
};

const getHeader = (value: string | string[] | undefined): string => {
  if (typeof value === 'string') {
    return value;
  }
  return value?.at(0) ?? '';
};

const requestDiagnostic = (request: IncomingMessage): RequestDiagnostic => {
  const contentEncoding =
    getHeader(request.headers['content-encoding']).toLowerCase() || 'identity';
  const contentType =
    getHeader(request.headers['content-type']).split(';', 1)[0]?.trim().toLowerCase() ?? '';
  let pathname = '/';
  try {
    const { pathname: parsedPath } = new URL(request.url ?? '/', 'http://fixture');
    pathname = parsedPath;
  } catch {
    pathname = '<invalid-path>';
  }
  return {
    bodyByteCount: 0,
    contentEncoding,
    contentType,
    method: request.method ?? 'UNKNOWN',
    path: pathname,
  };
};

const recordDiagnostic = (state: RuntimeState, diagnostic: RequestDiagnostic): void => {
  if (state.diagnostics.length < diagnosticLimit) {
    state.diagnostics.push(diagnostic);
  }
};

const handlePreflight = (
  request: IncomingMessage,
  response: ServerResponse,
  state: RuntimeState,
  pathname: string,
): boolean => {
  if (request.method === 'HEAD' && (pathname === '/' || pathname.endsWith('/v1/models'))) {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end();
    return true;
  }
  if (request.method === 'GET' && pathname.endsWith('/v1/models')) {
    const model = {
      created_at: '2026-02-17T00:00:00Z',
      display_name: 'Claude Sonnet 4.6',
      id: 'claude-sonnet-4-6',
      type: 'model',
    };
    sendJson(response, {
      data: [model],
      first_id: model.id,
      has_more: false,
      last_id: model.id,
    });
    return true;
  }
  if (request.method === 'POST' && pathname.endsWith('/v1/messages/count_tokens')) {
    sendJson(response, { input_tokens: 1 });
    return true;
  }
  if (request.method !== 'POST' || !pathname.endsWith('/v1/messages')) {
    setFailure(state, 'unexpected-api-path');
    response.writeHead(404);
    response.end();
    return true;
  }
  return false;
};

const respondToParent = (
  state: RuntimeState,
  requestBody: Record<string, unknown>,
  response: ServerResponse,
): void => {
  const agent = agentInput(requestBody);
  if (
    agent === undefined &&
    (!Array.isArray(requestBody.tools) || requestBody.tools.length === 0)
  ) {
    sendText(response, requestBody, 'msg_auth_probe', 'Ready.');
    return;
  }
  if (agent === undefined) {
    setFailure(state, 'agent-tool-schema-unavailable');
    state.phase = 'finished';
    sendText(response, requestBody, 'msg_probe_stop', fixtureStopText);
    return;
  }
  state.checks.agentToolExposed = true;
  state.checks.reviewerAgentDispatched = agent.input.subagent_type === 'maestria:reviewer';
  state.phase = 'awaiting-child';
  sendMessage(
    response,
    requestBody,
    { id: 'call_maestria_reviewer', input: agent.input, name: agent.name, type: 'tool_use' },
    'tool_use',
    'msg_parent_dispatch',
  );
};

const recordChildEvidence = (
  state: RuntimeState,
  requestBody: Record<string, unknown>,
  temporaryRoot: string,
  reviewerSkill: string,
  globalRulesSkill: string,
): void => {
  const systemText = normalizeText(
    collectText({ messages: requestBody.messages, system: requestBody.system }).join('\n'),
    temporaryRoot,
  );
  const toolNames = readToolNames(requestBody.tools);
  const normalizedNames = new Set(toolNames.map((name) => name.toLowerCase()));
  state.checks.childRequestObserved = true;
  state.checks.wrapperLoaded = systemText.includes('You are a Maestria specialist subagent.');
  state.checks.reviewerSkillPreloaded = systemText.includes(reviewerSkill);
  state.checks.globalRulesPreloaded = systemText.includes(globalRulesSkill);
  state.checks.childToolsPresent = toolNames.length > 0;
  state.checks.writeToolUnavailable = !normalizedNames.has('write');
  state.checks.editToolUnavailable = !normalizedNames.has('edit');
  state.contextDigests.childSystem = sha256(systemText);
  state.contextDigests.childTools = sha256([...toolNames].toSorted().join('\n'));
  if (
    !state.checks.wrapperLoaded ||
    !state.checks.reviewerSkillPreloaded ||
    !state.checks.globalRulesPreloaded
  ) {
    setFailure(state, 'child-preload-content-missing');
  } else if (
    !state.checks.childToolsPresent ||
    !state.checks.writeToolUnavailable ||
    !state.checks.editToolUnavailable
  ) {
    setFailure(state, 'read-only-tools-present-or-missing');
  }
};

const respondToChild = (
  state: RuntimeState,
  requestBody: Record<string, unknown>,
  response: ServerResponse,
  temporaryRoot: string,
  reviewerSkill: string,
  globalRulesSkill: string,
): void => {
  recordChildEvidence(state, requestBody, temporaryRoot, reviewerSkill, globalRulesSkill);
  state.phase = 'awaiting-parent-result';
  sendText(response, requestBody, 'msg_child_result', childResultText);
};

const respondToParentResult = (
  state: RuntimeState,
  requestBody: Record<string, unknown>,
  response: ServerResponse,
): void => {
  const returnedText = collectText(requestBody.messages).join('\n');
  state.checks.childResultReturnedToParent = returnedText.includes(childResultText);
  if (!state.checks.childResultReturnedToParent) {
    setFailure(state, 'child-result-not-returned');
  }
  state.phase = 'finished';
  sendText(response, requestBody, 'msg_parent_result', parentResultText);
};

const handleFixtureRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  state: RuntimeState,
  temporaryRoot: string,
  reviewerSkill: string,
  globalRulesSkill: string,
): Promise<void> => {
  const diagnostic = requestDiagnostic(request);
  recordDiagnostic(state, diagnostic);
  let body: Buffer;
  try {
    body = await readRequest(request, diagnostic);
  } catch (error) {
    setFailure(state, error instanceof Error ? error.message : 'request-read-failed');
    response.writeHead(400);
    response.end();
    return;
  }
  if (handlePreflight(request, response, state, diagnostic.path)) {
    return;
  }

  let requestBody: Record<string, unknown>;
  try {
    requestBody = parseRequest(body, diagnostic.contentEncoding);
  } catch (error) {
    setFailure(state, error instanceof Error ? error.message : 'request-invalid');
    response.writeHead(400);
    response.end();
    return;
  }
  if (state.phase === 'awaiting-parent') {
    respondToParent(state, requestBody, response);
  } else if (state.phase === 'awaiting-child') {
    respondToChild(state, requestBody, response, temporaryRoot, reviewerSkill, globalRulesSkill);
  } else if (state.phase === 'awaiting-parent-result') {
    respondToParentResult(state, requestBody, response);
  } else {
    // The CLI may request a final summary after returning the child result.
    // No additional tool calls are issued by the fixture.
    sendText(response, requestBody, 'msg_parent_summary', parentResultText);
  }
};

const listen = async (server: Server): Promise<number> => {
  const listening = once(server, 'listening');
  server.listen(0, '127.0.0.1');
  await listening;
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('fixture-listen-failed');
  }
  return address.port;
};

const closeServer = async (server: Server): Promise<void> => {
  if (!server.listening) {
    return;
  }
  const closed = once(server, 'close');
  server.close();
  server.closeAllConnections();
  await closed;
};

export const createPreloadFixture = async (
  temporaryRoot: string,
  state = createPreloadState(),
): Promise<PreloadFixture> => {
  const reviewerSkill = normalizeText(readSkillBody('skills/reviewer/SKILL.md'), temporaryRoot);
  const globalRulesSkill = normalizeText(
    readSkillBody('skills/global-rules/SKILL.md'),
    temporaryRoot,
  );
  state.contextDigests.reviewerSkill = sha256(reviewerSkill);
  state.contextDigests.globalRules = sha256(globalRulesSkill);
  const server = createServer((request, response) => {
    void (async () => {
      try {
        await handleFixtureRequest(
          request,
          response,
          state,
          temporaryRoot,
          reviewerSkill,
          globalRulesSkill,
        );
      } catch {
        setFailure(state, 'fixture-handler-failed');
        response.writeHead(500);
        response.end();
      }
    })();
  });
  const port = await listen(server);
  return {
    port,
    state,
    stop: async () => {
      await closeServer(server);
    },
  };
};
