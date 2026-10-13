import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import type * as FsPromises from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { DOCS_UPDATE_SKILL } from '@/lib/skill-companion.js';
import {
  getSkillsRecordPath,
  parseSkillsRecord,
  readSkillsRecord,
  withoutRecordedSelection,
  withRecordedSelection,
  writeSkillsRecord,
} from '@/lib/skills.js';
import { buildRecord } from './skill-test-support.js';

const source = 'test-record';
const PR = 'create-pull-request';

const fsControls = vi.hoisted(() => ({ failRename: false, failWrite: false }));

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof FsPromises>();
  return {
    ...actual,
    rename: async (from: string, to: string): Promise<void> => {
      if (fsControls.failRename) {
        throw new Error('rename boom');
      }
      await actual.rename(from, to);
    },
    writeFile: async (file: string, data: string, encoding: BufferEncoding): Promise<void> => {
      if (fsControls.failWrite) {
        throw new Error('write boom');
      }
      await actual.writeFile(file, data, encoding);
    },
  };
});

describe('legacy skill record', () => {
  it('keeps v2 per-skill assets separate and preserves unknown history', () => {
    const record = parseSkillsRecord(
      JSON.stringify({
        platforms: {
          opencode: {
            skillAssets: {
              [PR]: { path: '/fake/pr', source },
              [DOCS_UPDATE_SKILL]: { path: '/fake/docs', source },
              'future-skill': { path: '/fake/future', source },
            },
            skills: [PR, DOCS_UPDATE_SKILL, 'future-skill'],
          },
        },
        version: 2,
      }),
      source,
    );
    expect(record.platforms.opencode?.skillAssets?.[PR]?.path).toBe('/fake/pr');
    expect(record.platforms.opencode?.skillAssets?.[DOCS_UPDATE_SKILL]?.path).toBe('/fake/docs');
    expect(record.platforms.opencode?.skillAssets?.['future-skill']?.path).toBe('/fake/future');
  });

  it('reads a legacy record written before the cleanup-only migration', () => {
    const legacy = parseSkillsRecord(
      JSON.stringify({ platforms: { opencode: { skills: [PR] } }, version: 2 }),
      source,
    );
    expect(legacy.platforms.opencode?.skills).toEqual([PR]);
  });

  it('fails loudly on corrupt records instead of resetting to defaults', () => {
    const corruptPayloads = [
      'not json',
      '[]',
      JSON.stringify({ platforms: {}, version: 999 }),
      JSON.stringify({ platforms: { opencode: { skills: 'nope' } }, version: 2 }),
      JSON.stringify({
        platforms: { opencode: { skillAssets: { [PR]: { path: 42 } }, skills: [PR] } },
        version: 2,
      }),
    ];
    for (const payload of corruptPayloads) {
      expect(() => parseSkillsRecord(payload, 'test-record')).toThrow(Error);
    }
  });

  it('keeps entries per platform and cleans up only the removed entry', () => {
    const record = buildRecord({ hermes: [], opencode: [PR] });
    const added = withRecordedSelection(record, 'pi', []);
    expect(added.platforms.opencode?.skills).toEqual([PR]);
    expect(added.platforms.pi?.skills).toEqual([]);
    const removed = withoutRecordedSelection(added, 'opencode');
    expect(removed?.platforms.opencode).toBeUndefined();
    expect(removed?.platforms.hermes?.skills).toEqual([]);
    expect(withoutRecordedSelection(null, 'opencode')).toBeNull();
  });
});

describe('record write atomicity', () => {
  const dirs: string[] = [];

  beforeEach(async () => {
    fsControls.failRename = false;
    fsControls.failWrite = false;
    const dir = await mkdtemp(path.join(tmpdir(), 'maestria-skills-atomic-'));
    dirs.push(dir);
    vi.stubEnv('MAESTRIA_CONFIG_DIR', dir);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await Promise.all(
      dirs.splice(0).map(async (dir) => {
        await rm(dir, { force: true, recursive: true });
      }),
    );
  });

  it('preserves the prior record when the temp write or rename fails', async () => {
    await writeSkillsRecord(
      withRecordedSelection(null, 'opencode', [PR], { [PR]: { path: '/fake/p', source } }),
    );
    const recordPath = getSkillsRecordPath();
    const before = await readFile(recordPath, 'utf-8');
    fsControls.failWrite = true;
    await expect(
      writeSkillsRecord(withRecordedSelection(null, 'opencode', [PR, DOCS_UPDATE_SKILL])),
    ).rejects.toThrow('write boom');
    expect(await readFile(recordPath, 'utf-8')).toBe(before);
    expect(await readdir(path.dirname(recordPath))).toEqual(['skills.json']);
    const keptAfterWriteFailure = await readSkillsRecord();
    expect(keptAfterWriteFailure?.platforms.opencode?.skills).toEqual([PR]);
    fsControls.failWrite = false;

    await writeSkillsRecord(
      withRecordedSelection(null, 'opencode', [PR], { [PR]: { path: '/fake/p', source } }),
    );
    const beforeRename = await readFile(recordPath, 'utf-8');
    fsControls.failRename = true;
    await expect(
      writeSkillsRecord(withRecordedSelection(null, 'opencode', [PR, DOCS_UPDATE_SKILL])),
    ).rejects.toThrow('rename boom');
    expect(await readFile(recordPath, 'utf-8')).toBe(beforeRename);
    expect(await readdir(path.dirname(recordPath))).toEqual(['skills.json']);
    const keptAfterRenameFailure = await readSkillsRecord();
    expect(keptAfterRenameFailure?.platforms.opencode?.skills).toEqual([PR]);
  });
});
