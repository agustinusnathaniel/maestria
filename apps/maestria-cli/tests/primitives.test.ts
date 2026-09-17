import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import {
  isFileNotFound,
  isRecord,
  isWithin,
  parseJsonRecord,
  parseJsonValue,
  readJsonRecord,
} from '@/lib/primitives.js';

const tempDirectories: string[] = [];

const makeTempDirectory = async (): Promise<string> => {
  const directory = await mkdtemp(path.join(tmpdir(), 'maestria-primitives-'));
  tempDirectories.push(directory);
  return directory;
};

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map(async (directory) => {
      await rm(directory, { force: true, recursive: true });
    }),
  );
});

describe('primitives', () => {
  describe('isRecord', () => {
    it('accepts plain objects and rejects null, arrays, and primitives', () => {
      expect(isRecord({})).toBe(true);
      expect(isRecord(Object.create(null))).toBe(true);
      expect(isRecord(null)).toBe(false);
      expect(isRecord([])).toBe(false);
      expect(isRecord('value')).toBe(false);
      expect(isRecord(42)).toBe(false);
    });
  });

  describe('parseJsonValue', () => {
    it('parses valid JSON and returns undefined for invalid JSON', () => {
      expect(parseJsonValue('{"a":1}')).toEqual({ a: 1 });
      expect(parseJsonValue('not json')).toBeUndefined();
    });
  });

  describe('parseJsonRecord', () => {
    it('keeps objects and drops arrays and invalid input', () => {
      expect(parseJsonRecord('{"a":1}')).toEqual({ a: 1 });
      expect(parseJsonRecord('[1,2]')).toBeUndefined();
      expect(parseJsonRecord('nope')).toBeUndefined();
    });
  });

  describe('isFileNotFound', () => {
    it('detects ENOENT errors on unknown thrown values', () => {
      expect(isFileNotFound(Object.assign(new Error('missing'), { code: 'ENOENT' }))).toBe(true);
      expect(isFileNotFound({ code: 'ENOENT' })).toBe(true);
      expect(isFileNotFound({ code: 'EEXIST' })).toBe(false);
      expect(isFileNotFound(null)).toBe(false);
      expect(isFileNotFound('ENOENT')).toBe(false);
    });
  });

  describe('isWithin', () => {
    it('accepts the root itself and nested paths, rejects escapes', () => {
      expect(isWithin('/root', '/root')).toBe(true);
      expect(isWithin('/root', '/root/nested/file')).toBe(true);
      expect(isWithin('/root', '/other')).toBe(false);
      expect(isWithin('/root', '/root/../escape')).toBe(false);
    });
  });

  describe('readJsonRecord', () => {
    it('reads a JSON object file', async () => {
      const directory = await makeTempDirectory();
      const filePath = path.join(directory, 'data.json');
      await writeFile(filePath, '{"ok":true}');

      await expect(readJsonRecord(filePath)).resolves.toEqual({ ok: true });
    });

    it('rejects non-object JSON and missing files', async () => {
      const directory = await makeTempDirectory();
      const arrayPath = path.join(directory, 'array.json');
      await writeFile(arrayPath, '[1,2]');

      await expect(readJsonRecord(arrayPath)).rejects.toThrow('must contain a JSON object');
      await expect(readJsonRecord(path.join(directory, 'missing.json'))).rejects.toMatchObject({
        code: 'ENOENT',
      });
    });
  });
});
