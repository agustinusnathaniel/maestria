#!/usr/bin/env node
// Offline Claude Code E2E for maestria's plugin hooks: a real CLI session against a local
// Anthropic-compatible fixture, so no model runs and no credentials are used.
// Usage: node --experimental-strip-types scripts/e2e/claude-hooks.ts --out artifacts/claude-hooks-evidence.json

import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { gunzipSync } from 'node:zlib';

import { sendJson, sendMessage, sendText } from './claude-skill-preload-protocol.ts';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const packageRoot = path.join(repoRoot, 'packages/agent-plugins');
const timeoutMs = 30_000;
const blockedCommand = 'git commit --no-verify -m probe';

interface Evidence {
  checks: Record<string, boolean>;
  cliVersion: string;
  messageRequests: number;
  status: 'failed' | 'passed';
  toolResult: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Text of every tool_result block in a request, where the hook's reason surfaces. */
const toolResults = (body: Record<string, unknown>): string[] =>
  (Array.isArray(body.messages) ? body.messages : []).flatMap((message: unknown) =>
    isRecord(message) && Array.isArray(message.content)
      ? message.content
          .filter((block: unknown) => isRecord(block) && block.type === 'tool_result')
          .map((block: unknown) => JSON.stringify(block))
      : [],
  );

const startFixture = async (bodies: string[]) => {
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });
    request.on('end', () => {
      const { pathname } = new URL(request.url ?? '/', 'http://fixture');
      if (request.method !== 'POST') {
        sendJson(response, { data: [], has_more: false });
        return;
      }
      if (pathname.endsWith('/count_tokens')) {
        sendJson(response, { input_tokens: 1 });
        return;
      }
      const raw = Buffer.concat(chunks);
      const text = (
        request.headers['content-encoding'] === 'gzip' ? gunzipSync(raw) : raw
      ).toString('utf-8');
      bodies.push(text);
      const body: unknown = JSON.parse(text);
      const requestBody = isRecord(body) ? body : {};
      const hasTools = Array.isArray(requestBody.tools) && requestBody.tools.length > 0;
      if (!hasTools || toolResults(requestBody).length > 0) {
        sendText(response, requestBody, `msg_${bodies.length}`, 'Done.');
        return;
      }
      sendMessage(
        response,
        requestBody,
        { id: 'toolu_probe', input: { command: blockedCommand }, name: 'Bash', type: 'tool_use' },
        'tool_use',
        `msg_${bodies.length}`,
      );
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  return { port: typeof address === 'object' && address !== null ? address.port : 0, server };
};

const summarize = (bodies: string[], cliVersion: string): Evidence => {
  const all = bodies.join('\n');
  const toolResult =
    bodies
      .flatMap((text) => {
        const body: unknown = JSON.parse(text);
        return isRecord(body) ? toolResults(body) : [];
      })
      .at(0) ?? '';
  const checks = {
    coreLoopInjected:
      all.includes('## Routing') && all.includes('Claude Code and ZCode Integration'),
    coreRulesInjected:
      all.includes('## Universal Floors') && all.includes('## Precedence and Shipping'),
    gitHookBlockedNoVerify: toolResult.includes(
      'maestria: git commit --no-verify skips repository hooks',
    ),
    projectCustomizationInjected: all.includes('PROBE-WORKFLOW-MARKER'),
  };
  return {
    checks,
    cliVersion,
    messageRequests: bodies.length,
    status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
    toolResult: toolResult.slice(0, 600),
  };
};

const run = async (outPath: string): Promise<Evidence> => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'maestria-claude-hooks-'));
  const configDir = path.join(temporaryRoot, 'config');
  const cwd = path.join(temporaryRoot, 'workspace');
  fs.mkdirSync(configDir);
  fs.mkdirSync(path.join(cwd, '.maestria'), { recursive: true });
  fs.writeFileSync(path.join(cwd, '.maestria', 'workflow.md'), 'PROBE-WORKFLOW-MARKER\n');
  spawnSync('git', ['init', '-q', '-b', 'feature/probe', cwd]);
  const env: NodeJS.ProcessEnv = {
    ANTHROPIC_API_KEY: 'local-fixture-only',
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
    CLAUDE_CONFIG_DIR: configDir,
    HOME: process.env.HOME,
    PATH: process.env.PATH,
  };
  const version = spawnSync('claude', ['--version'], { encoding: 'utf-8', env, timeout: 5000 });
  const bodies: string[] = [];
  const { port, server } = await startFixture(bodies);
  env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${port}`;
  try {
    const cli = spawn(
      'claude',
      [
        '--plugin-dir',
        packageRoot,
        '--no-session-persistence',
        '--allowedTools',
        'Bash',
        '--print',
        'Run the probe command.',
      ],
      { cwd, env, stdio: 'ignore' },
    );
    const timer = setTimeout(() => {
      cli.kill('SIGKILL');
    }, timeoutMs);
    await once(cli, 'close');
    clearTimeout(timer);
  } finally {
    server.close();
    fs.rmSync(temporaryRoot, { force: true, recursive: true });
  }
  const evidence = summarize(bodies, version.status === 0 ? version.stdout.trim() : 'unavailable');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf-8');
  return evidence;
};

const outIndex = process.argv.indexOf('--out');
if (outIndex === -1 || process.argv[outIndex + 1] === undefined) {
  process.stderr.write('usage: claude-hooks.ts --out <path>\n');
  process.exit(2);
}
const outPath = path.resolve(repoRoot, process.argv[outIndex + 1] ?? '');
const evidence = await run(outPath);
process.stdout.write(`Claude hooks E2E ${evidence.status}: ${outPath}\n`);
if (evidence.status !== 'passed') {
  process.exitCode = 1;
}
