import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Shared low-level guards and parsers used by CLI helpers.
 *
 * Keep this module dependency-free apart from Node built-ins: higher-level
 * modules (platforms, model config, Agent Plugins) import from here instead of
 * re-declaring the same checks.
 */

export type JsonRecord = Record<string, unknown>;

/** True for plain objects; `null` and arrays are excluded. */
export const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string');

export const isStringRecord = (value: unknown): value is Record<string, string> =>
  isRecord(value) && Object.values(value).every((entry) => typeof entry === 'string');

/** Parse JSON text, returning `undefined` instead of throwing on invalid input. */
export const parseJsonValue = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

/** Parse JSON text and keep it only when it is a JSON object. */
export const parseJsonRecord = (text: string): JsonRecord | undefined => {
  const parsed = parseJsonValue(text);
  return isRecord(parsed) ? parsed : undefined;
};

/** True when an unknown thrown value is Node's `ENOENT` file-not-found error. */
export const isFileNotFound = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';

/** True when `target` is `root` itself or nested inside it. */
export const isWithin = (root: string, target: string): boolean => {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

/**
 * Read and parse a JSON object file.
 *
 * Throws on read errors and on JSON that is not an object, preserving the
 * error messages callers surface in validation reports.
 */
export const readJsonRecord = async (filePath: string): Promise<JsonRecord> => {
  const parsed: unknown = JSON.parse(await readFile(filePath, 'utf-8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error(`${filePath} must contain a JSON object`);
  }
  return parsed;
};
