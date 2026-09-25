import { readFile } from 'node:fs/promises';
import path from 'node:path';

/** Shared low-level guards and parsers. Keep dependency-free apart from Node built-ins. */

export type JsonRecord = Record<string, unknown>;

export const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string');

export const isStringRecord = (value: unknown): value is Record<string, string> =>
  isRecord(value) && Object.values(value).every((entry) => typeof entry === 'string');

export const parseJsonValue = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

export const parseJsonRecord = (text: string): JsonRecord | undefined => {
  const parsed = parseJsonValue(text);
  return isRecord(parsed) ? parsed : undefined;
};

export const isFileNotFound = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';

export const isWithin = (root: string, target: string): boolean => {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

export const readJsonRecord = async (filePath: string): Promise<JsonRecord> => {
  const parsed: unknown = JSON.parse(await readFile(filePath, 'utf-8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error(`${filePath} must contain a JSON object`);
  }
  return parsed;
};
