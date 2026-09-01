import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';

export const AGENT_PLUGIN_MCP_SCHEMA = 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json';

const PLUGIN_ROOT_PLACEHOLDER = ['$', '{PLUGIN_ROOT}'].join('');
const PLUGIN_DATA_PLACEHOLDER = ['$', '{PLUGIN_DATA}'].join('');
const HTTP_TOKEN_RE = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/u;

type JsonRecord = Record<string, unknown>;

export interface McpValidationReport {
  errors: string[];
  warnings: string[];
}

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string');

const isStringRecord = (value: unknown): value is Record<string, string> =>
  isRecord(value) && Object.values(value).every((entry) => typeof entry === 'string');

const hasInvalidHttpControl = (value: string): boolean => {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.codePointAt(index) ?? 0;
    if ((code >= 0 && code <= 8) || (code >= 10 && code <= 31) || code === 127) {
      return true;
    }
  }
  return false;
};

const isFileNotFound = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';

const isWithin = (root: string, target: string): boolean => {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

const addError = (report: McpValidationReport, message: string): void => {
  report.errors.push(message);
};

const addWarning = (report: McpValidationReport, message: string): void => {
  report.warnings.push(message);
};

const readJsonRecord = async (filePath: string): Promise<JsonRecord> => {
  const parsed: unknown = JSON.parse(await readFile(filePath, 'utf-8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error(`${filePath} must contain a JSON object`);
  }
  return parsed;
};

const validatePluginRelativePath = (
  value: string,
  root: string,
  label: string,
  report: McpValidationReport,
): void => {
  if (!value.startsWith('./')) {
    addError(report, `${label} must be a plugin-relative path beginning with ./`);
    return;
  }
  if (!isWithin(root, path.resolve(root, value))) {
    addError(report, `${label} resolves outside the plugin root`);
  }
};

const validateWorkingDirectory = (
  value: string,
  root: string,
  label: string,
  report: McpValidationReport,
): void => {
  if (value.startsWith('./')) {
    validatePluginRelativePath(value, root, label, report);
    return;
  }
  if (value === PLUGIN_ROOT_PLACEHOLDER || value.startsWith(`${PLUGIN_ROOT_PLACEHOLDER}/`)) {
    const suffix = value.slice(PLUGIN_ROOT_PLACEHOLDER.length).replace(/^\//u, '');
    validatePluginRelativePath(`./${suffix}`, root, label, report);
    return;
  }
  if (value === PLUGIN_DATA_PLACEHOLDER || value.startsWith(`${PLUGIN_DATA_PLACEHOLDER}/`)) {
    const suffix = value.slice(PLUGIN_DATA_PLACEHOLDER.length).replace(/^\//u, '');
    const normalized = path.posix.normalize(suffix);
    if (normalized === '..' || normalized.startsWith('../')) {
      addError(report, `${label} escapes PLUGIN_DATA`);
    }
    return;
  }
  addError(
    report,
    `${label} must use ./, ${PLUGIN_ROOT_PLACEHOLDER}, or ${PLUGIN_DATA_PLACEHOLDER}`,
  );
};

const validateHeaders = (value: unknown, label: string, report: McpValidationReport): void => {
  if (isStringRecord(value)) {
    const seen = new Set<string>();
    for (const key of Object.keys(value)) {
      if (!HTTP_TOKEN_RE.test(key)) {
        addError(report, `${label}.${key} is not a valid HTTP header name`);
      }
      const normalizedKey = key.toLowerCase();
      if (seen.has(normalizedKey)) {
        addError(report, `${label} contains duplicate header name: ${key}`);
      }
      seen.add(normalizedKey);
      if (hasInvalidHttpControl(value[key])) {
        addError(report, `${label}.${key} is not a valid HTTP header value`);
      }
      if (/(?:authorization|api[-_]?key|secret|token)/iu.test(key)) {
        addWarning(
          report,
          `${label}.${key} may contain credentials; review package data before use`,
        );
      }
    }
    return;
  }
  addError(report, `${label} must be an object of strings`);
};

const validateRemoteUrl = (value: unknown, label: string, report: McpValidationReport): void => {
  if (typeof value !== 'string') {
    addError(report, `${label} must be an absolute HTTP(S) URL`);
    return;
  }
  try {
    const url = new URL(value);
    const loopback =
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname.startsWith('127.') ||
      url.hostname === '[::1]';
    const validProtocol = ['http:', 'https:'].includes(url.protocol);
    if (!validProtocol || url.username || url.password || url.hash) {
      addError(report, `${label} is not a valid Agent Plugins v1 URL`);
    } else if (url.protocol !== 'https:' && !loopback) {
      addError(report, `${label} must use HTTPS outside loopback hosts`);
    }
  } catch {
    addError(report, `${label} must be an absolute HTTP(S) URL`);
  }
};

const validateStdioServer = (
  name: string,
  value: JsonRecord,
  root: string,
  report: McpValidationReport,
): void => {
  const label = `mcp.json server "${name}"`;
  const allowed = new Set(['args', 'command', 'cwd', 'env', 'type']);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      addError(report, `${label} field "${key}" is not allowed for stdio`);
    }
  }
  if (typeof value.command !== 'string' || value.command === '' || /\s/u.test(value.command)) {
    addError(report, `${label}.command must be one executable token`);
  } else if (value.command.startsWith('./')) {
    validatePluginRelativePath(value.command, root, `${label}.command`, report);
  }
  if (value.args !== undefined && !isStringArray(value.args)) {
    addError(report, `${label}.args must be an array of strings`);
  }
  if (value.env !== undefined && isStringRecord(value.env)) {
    for (const key of Object.keys(value.env)) {
      if (key === 'PLUGIN_ROOT' || key === 'PLUGIN_DATA') {
        addError(report, `${label}.env cannot override ${key}`);
      }
    }
  } else if (value.env !== undefined) {
    addError(report, `${label}.env must be an object of strings`);
  }
  if (typeof value.cwd === 'string') {
    validateWorkingDirectory(value.cwd, root, `${label}.cwd`, report);
  } else if (value.cwd !== undefined) {
    addError(report, `${label}.cwd must be a string`);
  }
};

const validateRemoteServer = (
  name: string,
  value: JsonRecord,
  report: McpValidationReport,
): void => {
  const label = `mcp.json server "${name}"`;
  const allowed = new Set(['headers', 'type', 'url']);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      addError(report, `${label} field "${key}" is not allowed for ${String(value.type)}`);
    }
  }
  validateRemoteUrl(value.url, `${label}.url`, report);
  if (value.headers !== undefined) {
    validateHeaders(value.headers, `${label}.headers`, report);
  }
};

const validateMcpServer = (
  name: string,
  value: unknown,
  root: string,
  report: McpValidationReport,
): void => {
  const label = `mcp.json server "${name}"`;
  if (!isRecord(value) || typeof value.type !== 'string') {
    addError(report, `${label} must be an object with a type`);
    return;
  }
  if (value.type === 'stdio') {
    validateStdioServer(name, value, root, report);
    return;
  }
  if (['streamable-http', 'sse'].includes(value.type)) {
    validateRemoteServer(name, value, report);
    return;
  }
  addError(report, `${label}.type must be stdio, streamable-http, or sse`);
};

export const validateMcp = async (root: string, report: McpValidationReport): Promise<void> => {
  const mcpPath = path.join(root, 'mcp.json');
  let mcpStat: Awaited<ReturnType<typeof stat>>;
  try {
    mcpStat = await stat(mcpPath);
  } catch (error) {
    if (isFileNotFound(error)) {
      return;
    }
    addError(report, `mcp.json cannot be read: ${String(error)}`);
    return;
  }
  if (!mcpStat.isFile()) {
    addError(report, 'mcp.json must be a regular file');
    return;
  }
  if (!isWithin(root, await realpath(mcpPath))) {
    addError(report, 'mcp.json resolves outside the plugin root');
    return;
  }

  let mcp: JsonRecord;
  try {
    mcp = await readJsonRecord(mcpPath);
  } catch (error) {
    addError(report, error instanceof Error ? error.message : String(error));
    return;
  }
  if (mcp.$schema !== AGENT_PLUGIN_MCP_SCHEMA) {
    addError(report, `mcp.json "$schema" must be ${AGENT_PLUGIN_MCP_SCHEMA}`);
  }
  for (const key of Object.keys(mcp)) {
    if (!['$schema', 'mcpServers'].includes(key)) {
      addError(report, `mcp.json field "${key}" is not allowed`);
    }
  }
  if (isRecord(mcp.mcpServers)) {
    for (const [name, server] of Object.entries(mcp.mcpServers)) {
      validateMcpServer(name, server, root, report);
    }
  } else {
    addError(report, 'mcp.json field "mcpServers" must be an object');
  }
};
