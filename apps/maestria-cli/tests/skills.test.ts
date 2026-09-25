import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import type * as FsPromises from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { CliError } from '@/lib/command-result.js';
import { DOCS_UPDATE_SKILL } from '@/lib/skill-companion.js';
import { reviewSkillSelections } from '@/lib/skill-prompts.js';
import {
  DEFAULT_SKILLS,
  getSkillsRecordPath,
  LEGACY_UPDATE_SKILLS,
  parseSkillsRecord,
  readSkillsRecord,
  resolveSkillSelection,
  withoutRecordedSelection,
  withRecordedSelection,
  writeSkillsRecord,
} from '@/lib/skills.js';
import { buildRecord } from './skill-test-support.js';
import { createTtyTestSupport } from './tty-test-support.js';

const source = 'test-record';
const PR = 'create-pull-request';

const fsControls = vi.hoisted(() => ({ failRename: false, failWrite: false }));

const groupMocks = vi.hoisted(() => ({
  groupMultiselect: vi.fn(),
}));
const promptMocks = vi.hoisted(() => ({
  cancel: vi.fn(),
  // oxlint-disable-next-line require-await -- synchronous confirm stub by design.
  confirm: vi.fn(async () => true),
  isCancel: vi.fn(() => false),
}));

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

vi.mock('@/lib/group-multiselect.js', () => ({
  groupMultiselect: groupMocks.groupMultiselect,
}));

vi.mock('@clack/prompts', () => ({
  cancel: promptMocks.cancel,
  confirm: promptMocks.confirm,
  isCancel: promptMocks.isCancel,
}));

const { restoreTty, setTty } = createTtyTestSupport();

describe('skill selection', () => {
  it('defaults fresh installs to both current skills', () => {
    expect(DEFAULT_SKILLS).toContain(PR);
    expect(DEFAULT_SKILLS).toContain(DOCS_UPDATE_SKILL);
    const resolved = resolveSkillSelection('opencode', {}, null);
    expect(resolved).toEqual({ changed: false, skills: [PR, DOCS_UPDATE_SKILL] });
  });

  it('keeps legacy updates without a record on the prior single skill', () => {
    expect(LEGACY_UPDATE_SKILLS).toEqual([PR]);
    expect(resolveSkillSelection('opencode', {}, null, { updateBootstrap: true })).toEqual({
      changed: false,
      skills: [PR],
    });
    expect(
      resolveSkillSelection('opencode', { skills: DOCS_UPDATE_SKILL }, null, {
        updateBootstrap: true,
      }),
    ).toEqual({ changed: true, skills: [DOCS_UPDATE_SKILL] });
  });

  it('preserves recorded choices when no flags are passed', () => {
    const record = buildRecord({ pi: [] });
    expect(resolveSkillSelection('pi', {}, record)).toEqual({ changed: false, skills: [] });
    expect(resolveSkillSelection('pi', {}, record, { updateBootstrap: true })).toEqual({
      changed: false,
      skills: [],
    });
    const legacy = parseSkillsRecord(
      JSON.stringify({ platforms: { opencode: { skills: [PR] } }, version: 2 }),
      source,
    );
    expect(resolveSkillSelection('opencode', {}, legacy)).toEqual({
      changed: false,
      skills: [PR],
    });
  });

  it.each([
    { expected: [PR], flags: { skills: PR }, name: 'explicit PR include' },
    {
      expected: [DOCS_UPDATE_SKILL],
      flags: { skills: DOCS_UPDATE_SKILL },
      name: 'explicit docs include without the other skill',
    },
    { expected: [], flags: { skills: 'none' }, name: 'none token' },
    {
      expected: [],
      flags: { excludeSkills: PR },
      name: 'exclusion onto recorded choices',
      record: buildRecord({ opencode: [PR] }),
    },
  ])('applies flag selections: $name', ({ expected, flags, record }) => {
    expect(resolveSkillSelection('opencode', flags, record ?? null)).toEqual({
      changed: true,
      skills: expected,
    });
  });

  it.each([
    { flags: { skills: 'nope' }, name: 'unknown include' },
    { flags: { excludeSkills: 'nope' }, name: 'unknown exclude' },
    {
      flags: { excludeSkills: PR, skills: PR },
      name: 'conflicting include/exclude',
    },
    { flags: { excludeSkills: PR, skills: 'none' }, name: 'none with exclude' },
    { flags: { skills: `none,${PR}` }, name: 'none with another skill' },
  ])('rejects invalid flag selections before any external effect: $name', ({ flags }) => {
    expect(() => resolveSkillSelection('opencode', flags, null)).toThrow(CliError);
  });

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
    expect(resolveSkillSelection('opencode', {}, record).skills).toEqual([
      PR,
      DOCS_UPDATE_SKILL,
      'future-skill',
    ]);
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
      expect(() => parseSkillsRecord(payload, 'test-record')).toThrow(CliError);
    }
  });

  it('keeps selections per platform and cleans up only the uninstalled entry', () => {
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

describe('reviewSkillSelections', () => {
  afterEach(() => {
    restoreTty();
    groupMocks.groupMultiselect.mockReset();
    promptMocks.confirm.mockClear();
  });

  it('preserves distinct per-platform intents without flags outside a TTY', async () => {
    const record = buildRecord({ opencode: [PR], pi: [] });
    const selections = [{ id: 'opencode' }, { id: 'pi' }].map((target) => ({
      ...target,
      selection: resolveSkillSelection(target.id, {}, record),
    }));

    const effective = await reviewSkillSelections(selections, 'Update', {});

    expect(effective.map((entry) => [entry.id, entry.selection.skills])).toEqual([
      ['opencode', [PR]],
      ['pi', []],
    ]);
    expect(effective.every((entry) => !entry.selection.changed)).toBe(true);
  });

  it('requires confirmation for flag-driven changes outside a TTY', async () => {
    const selections = [{ id: 'opencode' }].map((target) => ({
      ...target,
      selection: resolveSkillSelection(target.id, { skills: 'none' }, null),
    }));

    await expect(reviewSkillSelections(selections, 'Update', { skills: 'none' })).rejects.toThrow(
      CliError,
    );
    const confirmed = await reviewSkillSelections(selections, 'Update', {
      skills: 'none',
      yes: true,
    });
    expect(confirmed[0]?.selection.skills).toEqual([]);
  });

  it('passes through unchanged flag selections without confirmation', async () => {
    const record = buildRecord({ opencode: [] });
    const selections = [{ id: 'opencode' }].map((target) => ({
      ...target,
      selection: resolveSkillSelection(target.id, { skills: 'none' }, record),
    }));

    const effective = await reviewSkillSelections(selections, 'Update', {});

    expect(effective[0]?.selection).toEqual({ changed: false, skills: [] });
  });

  it.each([
    {
      changed: false,
      confirmCalls: 0,
      name: 'skips the trailing confirm when the interactive review changes nothing',
      reviewed: [PR],
    },
    {
      changed: true,
      confirmCalls: 1,
      name: 'still confirms when the interactive review changes the selection',
      reviewed: [],
    },
  ])('$name', async ({ changed, confirmCalls, reviewed }) => {
    setTty(true);
    const record = buildRecord({ opencode: [PR] });
    const selections = [{ id: 'opencode' }].map((target) => ({
      ...target,
      selection: resolveSkillSelection(target.id, {}, record),
    }));
    groupMocks.groupMultiselect.mockResolvedValueOnce(reviewed);

    const effective = await reviewSkillSelections(selections, 'Update', {});

    expect(groupMocks.groupMultiselect).toHaveBeenCalledTimes(1);
    expect(effective[0]?.selection).toEqual({ changed, skills: reviewed });
    expect(promptMocks.confirm).toHaveBeenCalledTimes(confirmCalls);
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
