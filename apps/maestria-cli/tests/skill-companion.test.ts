import { mkdtempSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { CliError } from '@/lib/command-result.js';
import {
  COMPANION_SKILL,
  DOCS_UPDATE_SKILL,
  listCompanions,
  removeCompanion,
} from '@/lib/skill-companion.js';
import type { SkillCommandRunner } from '@/lib/skill-companion.js';
import { removeLegacyCompanions } from '@/lib/skill-reconcile.js';
import { buildRecord, fakeSkillCli, listJson } from './skill-test-support.js';

const SKILL = COMPANION_SKILL;
const DOCS = DOCS_UPDATE_SKILL;
const SOURCE = 'test-source';
const AGENT = 'opencode';

const staticRunner =
  (stdout: string): SkillCommandRunner =>
  // oxlint-disable-next-line require-await -- synchronous fake runner by design.
  async () => ({ stderr: '', stdout });

const seedInstalled = async (
  runner: SkillCommandRunner,
  agents: readonly { agent: string; skill: string }[],
): Promise<void> => {
  for (const { agent, skill } of agents) {
    // oxlint-disable-next-line no-await-in-loop -- sequential seeding keeps shared-path order deterministic.
    await runner(['add', SOURCE, '-a', agent, '-s', skill, '-g', '--json', '-y']);
  }
};

const seedPair = async (runner: SkillCommandRunner): Promise<void> => {
  await seedInstalled(runner, [
    { agent: 'codex', skill: SKILL },
    { agent: 'opencode', skill: SKILL },
  ]);
};

const okResult = (id: string, label: string) => ({ id, label, message: 'Done', ok: true });

const configDirs: string[] = [];

beforeEach(() => {
  const dir = mkdtempSync(path.join(tmpdir(), 'maestria-skill-record-'));
  configDirs.push(dir);
  vi.stubEnv('MAESTRIA_CONFIG_DIR', dir);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(
    configDirs.splice(0).map(async (dir) => {
      await rm(dir, { force: true, recursive: true });
    }),
  );
});

const isolateRecord = async (): Promise<void> => {
  const dir = await mkdtemp(path.join(tmpdir(), 'maestria-skill-record-'));
  configDirs.push(dir);
  vi.stubEnv('MAESTRIA_CONFIG_DIR', dir);
};

describe('skills CLI adapter', () => {
  it('lists tool-observed name/path inventory', async () => {
    const runner = fakeSkillCli({ [AGENT]: '/fake/home/.agents/skills/create-pull-request' });
    await seedInstalled(runner, [{ agent: AGENT, skill: SKILL }]);
    expect(await listCompanions(runner, AGENT, { global: true })).toEqual([
      { name: SKILL, path: '/fake/home/.agents/skills/create-pull-request' },
    ]);
  });

  it('rejects non-JSON list output instead of guessing', async () => {
    const runner = staticRunner('not json');
    await expect(listCompanions(runner, AGENT, { global: true })).rejects.toThrow(CliError);
  });

  it('rejects the invalid-agent marker instead of trusting exit 0', async () => {
    const runner = staticRunner('Invalid agents: x');
    await expect(listCompanions(runner, 'x', { global: true })).rejects.toThrow(CliError);
  });

  it('treats absent-skill removal as success and verifies removal by re-listing', async () => {
    const runner = fakeSkillCli({ [AGENT]: '/fake/home/.agents/skills/create-pull-request' });
    expect(await removeCompanion(runner, { agent: AGENT, skill: SKILL }, { global: true })).toEqual(
      { removed: false },
    );
    await seedInstalled(runner, [{ agent: AGENT, skill: SKILL }]);
    expect(await removeCompanion(runner, { agent: AGENT, skill: SKILL }, { global: true })).toEqual(
      { removed: true },
    );
    expect(await listCompanions(runner, AGENT, { global: true })).toEqual([]);
  });

  it('fails when removal exits 0 but the skill is still listed', async () => {
    // oxlint-disable-next-line require-await -- synchronous fake runner by design.
    const runner: SkillCommandRunner = async (args) =>
      args[0] === 'list'
        ? { stderr: '', stdout: listJson([{ name: SKILL, path: '/fake/p' }]) }
        : { stderr: '', stdout: 'Done!' };
    await expect(
      removeCompanion(runner, { agent: AGENT, skill: SKILL }, { global: true }),
    ).rejects.toThrow(/still listed/u);
  });
});

describe('remove legacy companions', () => {
  it('leaves companions in place with a manual command when no record exists', async () => {
    const runner = fakeSkillCli({ [AGENT]: '/fake/p' });
    await seedInstalled(runner, [{ agent: AGENT, skill: SKILL }]);
    const combined = await removeLegacyCompanions(runner, null, [okResult('opencode', 'OpenCode')]);
    expect(combined.results[0]?.ok).toBe(true);
    expect(combined.results[0]?.message).toMatch(/left in place.*manually/u);
    expect(await listCompanions(runner, AGENT, { global: true })).toHaveLength(1);
  });

  it('stays silent without a record when the caller opts out of the note', async () => {
    const runner = fakeSkillCli({ [AGENT]: '/fake/p' });
    await seedInstalled(runner, [{ agent: AGENT, skill: SKILL }]);
    const before = okResult('opencode', 'OpenCode');
    const calls: string[][] = [];
    const counting: SkillCommandRunner = async (args, options) => {
      calls.push([...args]);
      return await runner(args, options);
    };
    const combined = await removeLegacyCompanions(counting, null, [before], {
      silentWhenUnrecorded: true,
    });
    expect(combined.results).toEqual([before]);
    expect(calls).toEqual([]);
    expect(await listCompanions(runner, AGENT, { global: true })).toHaveLength(1);
  });

  it('removes owned copies and drops only the cleaned platform record', async () => {
    await isolateRecord();
    const runner = fakeSkillCli({ [AGENT]: '/fake/p' });
    await seedInstalled(runner, [{ agent: AGENT, skill: SKILL }]);
    const record = buildRecord({ cursor: [SKILL], opencode: [SKILL] });
    const combined = await removeLegacyCompanions(runner, record, [
      okResult('opencode', 'OpenCode'),
    ]);
    expect(combined.results[0]?.ok).toBe(true);
    expect(await listCompanions(runner, AGENT, { global: true })).toEqual([]);
    const { readSkillsRecord } = await import('@/lib/skills.js');
    const saved = await readSkillsRecord();
    expect(saved?.platforms.opencode).toBeUndefined();
    expect(saved?.platforms.cursor?.skills).toEqual([SKILL]);
  });

  it('removes each recorded managed skill while keeping unrecorded copies', async () => {
    await isolateRecord();
    const runner = fakeSkillCli({});
    await seedInstalled(runner, [
      { agent: 'opencode', skill: SKILL },
      { agent: 'opencode', skill: DOCS },
      { agent: 'cursor', skill: DOCS },
    ]);
    const calls: string[][] = [];
    const spying: SkillCommandRunner = async (args, options) => {
      calls.push([...args]);
      return await runner(args, options);
    };
    const record = buildRecord({ opencode: [SKILL, DOCS] });
    const combined = await removeLegacyCompanions(spying, record, [
      okResult('opencode', 'OpenCode'),
    ]);
    expect(combined.results[0]?.ok).toBe(true);
    const removed = calls.filter((args) => args[0] === 'remove');
    expect(removed.map((args) => args[1]).toSorted()).toEqual([DOCS, SKILL].toSorted());
    expect(removed.every((args) => args.includes('-g') && args.includes('-y'))).toBe(true);
    expect(removed.some((args) => args.includes('cursor'))).toBe(false);
    expect(await listCompanions(runner, 'cursor', { global: true })).toHaveLength(1);
    const { readSkillsRecord } = await import('@/lib/skills.js');
    const savedRecord = await readSkillsRecord();
    expect(savedRecord?.platforms.opencode).toBeUndefined();
  });

  it('preserves the shared copy when another owned platform stays installed', async () => {
    const shared = '/fake/shared/create-pull-request';
    const runner = fakeSkillCli({ codex: shared, opencode: shared });
    await seedPair(runner);
    const record = buildRecord({ codex: [SKILL], opencode: [SKILL] });
    const combined = await removeLegacyCompanions(runner, record, [
      okResult('opencode', 'OpenCode'),
    ]);
    expect(combined.results[0]?.ok).toBe(true);
    expect(combined.results[0]?.message).toMatch(/still provided by 'codex'/u);
    expect(await listCompanions(runner, 'codex', { global: true })).toEqual([
      { name: SKILL, path: shared },
    ]);
  });

  it('preserves the shared copy for an unrecorded external consumer on uninstall', async () => {
    await isolateRecord();
    const shared = '/fake/shared/create-pull-request';
    const runner = fakeSkillCli({ codex: shared, opencode: shared });
    await seedPair(runner);
    const record = buildRecord({ opencode: [SKILL] });
    const combined = await removeLegacyCompanions(runner, record, [
      okResult('opencode', 'OpenCode'),
    ]);
    expect(combined.results[0]?.ok).toBe(true);
    expect(combined.results[0]?.message).toMatch(/still provided by 'codex'/u);
    expect(await listCompanions(runner, 'opencode', { global: true })).toEqual([
      { name: SKILL, path: shared },
    ]);
    expect(await listCompanions(runner, 'codex', { global: true })).toEqual([
      { name: SKILL, path: shared },
    ]);
    const { readSkillsRecord } = await import('@/lib/skills.js');
    const savedRecord = await readSkillsRecord();
    expect(savedRecord?.platforms.opencode).toBeUndefined();
  });

  it('preserves when external inventory cannot verify exclusive ownership', async () => {
    const shared = '/fake/shared/create-pull-request';
    const base = fakeSkillCli({ opencode: shared });
    await seedInstalled(base, [{ agent: 'opencode', skill: SKILL }]);
    // oxlint-disable-next-line require-await -- synchronous fake runner by design.
    const runner: SkillCommandRunner = async (args: readonly string[]) => {
      const agentFlag = args.indexOf('-a');
      const agent = agentFlag === -1 ? '' : (args[agentFlag + 1] ?? '');
      if (args[0] === 'list' && agent !== 'opencode') {
        throw new Error('list unavailable');
      }
      return await base(args);
    };
    const record = buildRecord({ opencode: [SKILL] });
    const combined = await removeLegacyCompanions(runner, record, [
      okResult('opencode', 'OpenCode'),
    ]);
    expect(combined.results[0]?.ok).toBe(true);
    expect(combined.results[0]?.message).toMatch(/still provided by/u);
    expect(await listCompanions(base, 'opencode', { global: true })).toEqual([
      { name: SKILL, path: shared },
    ]);
  });

  it('keeps the record for retry when removal fails', async () => {
    await isolateRecord();
    const runner = fakeSkillCli({ [AGENT]: '/fake/p' });
    await seedInstalled(runner, [{ agent: AGENT, skill: SKILL }]);
    // oxlint-disable-next-line require-await -- synchronous fake runner by design.
    const failing: SkillCommandRunner = async (args: readonly string[]) => {
      if (args[0] === 'remove') {
        throw new Error('remove backend unavailable');
      }
      return await runner(args);
    };
    const record = buildRecord({ opencode: [SKILL] });
    const { writeSkillsRecord, readSkillsRecord } = await import('@/lib/skills.js');
    await writeSkillsRecord(record);
    const combined = await removeLegacyCompanions(failing, record, [
      okResult('opencode', 'OpenCode'),
    ]);
    expect(combined.results[0]?.ok).toBe(false);
    expect(combined.results[0]?.message).toMatch(/Legacy skill removal failed/u);
    expect(combined.results[0]?.message).toMatch(/Retry manually/u);
    const savedRecord = await readSkillsRecord();
    expect(savedRecord?.platforms.opencode?.skills).toEqual([SKILL]);
  });

  it('skips failed plugin results without touching the record', async () => {
    await isolateRecord();
    const runner = fakeSkillCli({ [AGENT]: '/fake/p' });
    await seedInstalled(runner, [{ agent: AGENT, skill: SKILL }]);
    const record = buildRecord({ opencode: [SKILL] });
    const failed = { id: 'opencode', label: 'OpenCode', message: 'Failed', ok: false };
    const combined = await removeLegacyCompanions(runner, record, [failed]);
    expect(combined.results).toEqual([failed]);
    expect(await listCompanions(runner, AGENT, { global: true })).toHaveLength(1);
    const { readSkillsRecord } = await import('@/lib/skills.js');
    expect(await readSkillsRecord()).toBeNull();
  });
});

describe('record roundtrip', () => {
  it('keeps unknown skill history when removing managed skills', async () => {
    await isolateRecord();
    const runner = fakeSkillCli({ [AGENT]: '/fake/p' });
    await seedInstalled(runner, [{ agent: AGENT, skill: SKILL }]);
    const record = buildRecord({ opencode: [SKILL, 'future-skill'] });
    const combined = await removeLegacyCompanions(runner, record, [
      okResult('opencode', 'OpenCode'),
    ]);
    expect(combined.results[0]?.ok).toBe(true);
    expect(await listCompanions(runner, AGENT, { global: true })).toEqual([]);
    const { readSkillsRecord } = await import('@/lib/skills.js');
    const savedRecord = await readSkillsRecord();
    expect(savedRecord?.platforms.opencode?.skills).toEqual(['future-skill']);
  });
});
