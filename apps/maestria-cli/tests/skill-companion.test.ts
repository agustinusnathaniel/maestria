import { mkdtempSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { CliError } from '@/lib/command-result.js';
import {
  addCompanion,
  COMPANION_SKILL,
  DOCS_UPDATE_SKILL,
  listCompanions,
  removeCompanion,
} from '@/lib/skill-companion.js';
import type { SkillCommandRunner } from '@/lib/skill-companion.js';
import {
  applyCompanionOutcomes,
  preflightCompanionOwnership,
  reconcileCompanions,
  reconcileUninstallCompanions,
  resolveEffectiveSkills,
  resolveSkillsSource,
} from '@/lib/skill-reconcile.js';
import { buildRecord, fakeSkillCli, listJson, skillOf } from './skill-test-support.js';

const SKILL = COMPANION_SKILL;
const DOCS = DOCS_UPDATE_SKILL;
const SOURCE = 'test-source';
const AGENT = 'opencode';

const staticRunner =
  (stdout: string): SkillCommandRunner =>
  // oxlint-disable-next-line require-await -- synchronous fake runner by design.
  async () => ({ stderr: '', stdout });

const seedPair = async (runner: SkillCommandRunner, agents: readonly string[]): Promise<void> => {
  for (const agent of agents) {
    // oxlint-disable-next-line no-await-in-loop -- sequential seeding keeps shared-path order deterministic.
    await addCompanion(runner, { agent, skill: SKILL, source: SOURCE }, { global: true });
  }
};

const configDirs: string[] = [];

beforeEach(() => {
  vi.stubEnv('MAESTRIA_SKILLS_SOURCE', SOURCE);
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
  it('confirms installs from trailing JSON and returns the observed path', async () => {
    const runner = fakeSkillCli({ [AGENT]: '/fake/home/.agents/skills/create-pull-request' });
    const installed = await addCompanion(
      runner,
      { agent: AGENT, skill: SKILL, source: SOURCE },
      { global: true },
    );
    expect(installed.path).toBe('/fake/home/.agents/skills/create-pull-request');
    const listed = await listCompanions(runner, AGENT, { global: true });
    expect(listed).toEqual([
      { name: SKILL, path: '/fake/home/.agents/skills/create-pull-request' },
    ]);
  });

  it('fails loud when the tool does not confirm the install', async () => {
    const runner = staticRunner('Invalid agents: x');
    await expect(
      addCompanion(runner, { agent: 'x', skill: SKILL, source: SOURCE }, { global: true }),
    ).rejects.toThrow(CliError);
  });

  it('rejects non-JSON list output instead of guessing', async () => {
    const runner = staticRunner('not json');
    await expect(listCompanions(runner, AGENT, { global: true })).rejects.toThrow(CliError);
  });

  it('treats absent-skill removal as success and verifies removal by re-listing', async () => {
    const runner = fakeSkillCli({ [AGENT]: '/fake/home/.agents/skills/create-pull-request' });
    expect(await removeCompanion(runner, { agent: AGENT, skill: SKILL }, { global: true })).toEqual(
      { removed: false },
    );
    await addCompanion(runner, { agent: AGENT, skill: SKILL, source: SOURCE }, { global: true });
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

  it('resolves the configured source', () => {
    expect(resolveSkillsSource()).toBe(SOURCE);
  });
});

describe('ownership preflight', () => {
  it('passes for owned selections without listing', async () => {
    const seen: string[][] = [];
    // oxlint-disable-next-line require-await -- synchronous fake runner by design.
    const runner: SkillCommandRunner = async (args: readonly string[]) => {
      seen.push([...args]);
      return { stderr: '', stdout: '[]' };
    };
    const record = buildRecord({ [AGENT]: [SKILL, DOCS] });
    const effective = resolveEffectiveSkills([{ id: 'opencode' }], {}, record);
    await preflightCompanionOwnership(runner, record, effective);
    expect(seen).toEqual([]);
  });

  it('aborts on unmanaged copies with the exclude-or-remove guidance', async () => {
    const runner = fakeSkillCli({ [AGENT]: '/observed/.agents/skills/create-pull-request' });
    await addCompanion(runner, { agent: AGENT, skill: SKILL, source: SOURCE }, { global: true });
    const effective = resolveEffectiveSkills([{ id: 'opencode' }], {}, null);
    await expect(preflightCompanionOwnership(runner, null, effective)).rejects.toThrow(
      /Existing unmanaged skill.*--exclude-skills/u,
    );
  });

  it('never checks targets selected for exclusion', async () => {
    const seen: string[][] = [];
    // oxlint-disable-next-line require-await -- synchronous fake runner by design.
    const runner: SkillCommandRunner = async (args: readonly string[]) => {
      seen.push([...args]);
      return { stderr: '', stdout: '[]' };
    };
    const record = buildRecord({ [AGENT]: [SKILL, DOCS] });
    const effective = resolveEffectiveSkills(
      [{ id: 'opencode' }],
      { excludeSkills: SKILL },
      record,
    );
    await preflightCompanionOwnership(runner, record, effective);
    expect(seen).toEqual([]);
  });

  it.each([
    {
      allows: true,
      name: 'allows a new platform when the observed path matches a recorded asset from the same source',
      recordSource: SOURCE,
    },
    {
      allows: false,
      name: 'rejects when the observed path matches a recorded asset from another source',
      recordSource: 'other-source',
    },
  ])('$name', async ({ allows, recordSource }) => {
    const shared = '/fake/shared/create-pull-request';
    const runner = fakeSkillCli({ opencode: shared, universal: shared });
    await seedPair(runner, ['opencode', 'universal']);
    const record = buildRecord({
      opencode: {
        skillAssets: { [SKILL]: { path: shared, source: recordSource } },
        skills: [SKILL],
      },
    });
    const effective = resolveEffectiveSkills([{ id: 'omp' }], {}, record);
    const check = preflightCompanionOwnership(runner, record, effective, SOURCE);
    await (allows ? check : expect(check).rejects.toThrow(/Existing unmanaged skill/u));
  });

  it('installs a second platform onto the same asset without error or duplicate copy', async () => {
    const shared = '/fake/shared/create-pull-request';
    const runner = fakeSkillCli({ opencode: shared, universal: shared });
    await addCompanion(
      runner,
      { agent: 'opencode', skill: SKILL, source: SOURCE },
      { global: true },
    );
    const record = buildRecord({
      opencode: {
        skillAssets: { [SKILL]: { path: shared, source: SOURCE } },
        skills: [SKILL],
      },
    });
    const effective = resolveEffectiveSkills([{ id: 'omp' }], {}, record);
    await preflightCompanionOwnership(runner, record, effective, SOURCE);
    const outcome = await reconcileCompanions(
      runner,
      record,
      effective,
      new Map([['omp', true]]),
      SOURCE,
    );
    expect(outcome.ok.get('omp')).toBe(true);
    expect(await listCompanions(runner, 'universal', { global: true })).toContainEqual({
      name: SKILL,
      path: shared,
    });
  });
});

describe('reconcile companions', () => {
  it('adds selected skills and records the observed source and path', async () => {
    await isolateRecord();
    const runner = fakeSkillCli({
      [AGENT]: '/fake/shared/create-pull-request',
      [`${AGENT}:${DOCS}`]: '/fake/shared/docs-update',
    });
    const { writeSkillsRecord } = await import('@/lib/skills.js');
    const { persistSuccessfulSelections } = await import('@/lib/skills.js');
    const { attachCompanionObserved } = await import('@/lib/skill-reconcile.js');
    const effective = resolveEffectiveSkills([{ id: 'opencode' }], {}, null);
    expect(effective[0]?.selection.skills).toEqual([SKILL, DOCS]);
    const outcome = await reconcileCompanions(
      runner,
      null,
      effective,
      new Map([['opencode', true]]),
      SOURCE,
    );
    expect(outcome.ok.get('opencode')).toBe(true);
    expect(outcome.actual.get('opencode')).toEqual([SKILL, DOCS]);
    await persistSuccessfulSelections(
      null,
      attachCompanionObserved(effective, outcome),
      [{ id: 'opencode', ok: true }],
      false,
    );
    const { readSkillsRecord } = await import('@/lib/skills.js');
    const saved = await readSkillsRecord();
    expect(saved?.platforms.opencode?.skills).toEqual([SKILL, DOCS]);
    expect(saved?.platforms.opencode?.skillAssets?.[SKILL]).toMatchObject({ source: SOURCE });
    expect(saved?.platforms.opencode?.skillAssets?.[DOCS]?.source).toBe(SOURCE);
    expect(saved?.platforms.opencode?.skillAssets?.[SKILL]?.path).toBe(
      '/fake/shared/create-pull-request',
    );
    expect(saved?.platforms.opencode?.skillAssets?.[DOCS]?.path).toBe('/fake/shared/docs-update');
    await writeSkillsRecord(saved ?? { platforms: {}, version: 2 });
  });

  it('records partial success recoverably and never marks the failed skill installed', async () => {
    await isolateRecord();
    const base = fakeSkillCli({ [AGENT]: '/fake/p' });
    // oxlint-disable-next-line require-await -- synchronous fake runner by design.
    const runner: SkillCommandRunner = async (args: readonly string[]) => {
      if (args[0] === 'add' && skillOf(args) === DOCS) {
        throw new Error('docs backend unavailable');
      }
      return await base(args);
    };
    const { persistSuccessfulSelections } = await import('@/lib/skills.js');
    const { attachCompanionObserved } = await import('@/lib/skill-reconcile.js');
    const effective = resolveEffectiveSkills([{ id: 'opencode' }], {}, null);
    const outcome = await reconcileCompanions(
      runner,
      null,
      effective,
      new Map([['opencode', true]]),
      SOURCE,
    );
    expect(outcome.ok.get('opencode')).toBe(false);
    expect(outcome.actual.get('opencode')).toEqual([SKILL]);
    const combined = applyCompanionOutcomes(
      [{ id: 'opencode', label: 'OpenCode', message: 'Installed', ok: true }],
      effective,
      outcome,
    );
    expect(combined[0]?.ok).toBe(false);
    expect(combined[0]?.skills).toEqual([SKILL]);
    expect(combined[0]?.message).toMatch(/only confirmed skills were recorded/u);
    expect(combined[0]?.message).toMatch(/Retry with --skills/u);
    await persistSuccessfulSelections(
      null,
      attachCompanionObserved(effective, outcome),
      combined.map((result) => ({ id: result.id, ok: result.ok })),
      false,
    );
    const { readSkillsRecord } = await import('@/lib/skills.js');
    const saved = await readSkillsRecord();
    expect(saved?.platforms.opencode?.skills).toEqual([SKILL]);
    expect(saved?.platforms.opencode?.skillAssets?.[SKILL]?.source).toBe(SOURCE);
    expect(saved?.platforms.opencode?.skillAssets?.[DOCS]).toBeUndefined();
  });

  it('aborts on an unmanaged docs-update copy before any plugin effect', async () => {
    const runner = fakeSkillCli({ [AGENT]: '/fake/stray/docs-update' });
    await addCompanion(runner, { agent: AGENT, skill: DOCS, source: SOURCE }, { global: true });
    const effective = resolveEffectiveSkills([{ id: 'opencode' }], { skills: DOCS }, null);
    await expect(preflightCompanionOwnership(runner, null, effective)).rejects.toThrow(
      /Existing unmanaged skill 'docs-update'.*--exclude-skills docs-update/u,
    );
  });

  it('preserves unknown skill IDs with a note and never runs them', async () => {
    const seen: string[][] = [];
    const inner = fakeSkillCli({});
    const runner: SkillCommandRunner = async (args: readonly string[]) => {
      seen.push([...args]);
      return await inner(args);
    };
    const record = buildRecord({ opencode: [SKILL, 'future-skill'] });
    const effective = resolveEffectiveSkills([{ id: 'opencode' }], {}, record);
    const outcome = await reconcileCompanions(
      runner,
      record,
      effective,
      new Map([['opencode', true]]),
      SOURCE,
    );
    expect(outcome.ok.get('opencode')).toBe(true);
    expect(outcome.notes.get('opencode')).toMatch(/not managed by this CLI version/u);
    expect(outcome.actual.get('opencode')).toEqual([SKILL, 'future-skill']);
    expect(seen.filter((args) => args.includes('future-skill'))).toEqual([]);
  });

  it('preserves shared copies while another owned platform stays active', async () => {
    const shared = '/fake/shared/create-pull-request';
    const runner = fakeSkillCli({ codex: shared, opencode: shared });
    await seedPair(runner, ['codex', 'opencode']);
    const record = buildRecord({ codex: [SKILL], opencode: [SKILL] });
    const effective = resolveEffectiveSkills(
      [{ id: 'codex' }, { id: 'opencode' }],
      { excludeSkills: SKILL },
      record,
    );
    const outcome = await reconcileCompanions(
      runner,
      record,
      effective,
      new Map([
        ['codex', true],
        ['opencode', true],
      ]),
      SOURCE,
    );
    expect(outcome.ok.get('codex')).toBe(true);
    expect(await listCompanions(runner, 'codex', { global: true })).toEqual([]);
  });

  it('skips removal for one platform when the other stays on the shared path', async () => {
    const shared = '/fake/shared/create-pull-request';
    const runner = fakeSkillCli({ codex: shared, opencode: shared });
    await seedPair(runner, ['codex', 'opencode']);
    const staying = buildRecord({ codex: [SKILL], opencode: [SKILL] });
    const onlyOpencode = [{ id: 'opencode', label: undefined as string | undefined }].map(
      (target) => ({
        ...target,
        selection: { changed: true, skills: [] as string[] },
      }),
    );
    const outcome = await reconcileCompanions(
      runner,
      staying,
      onlyOpencode,
      new Map([['opencode', true]]),
      SOURCE,
    );
    expect(outcome.ok.get('opencode')).toBe(true);
    expect(outcome.notes.get('opencode')).toMatch(/still provided by 'codex'/u);
    expect(await listCompanions(runner, 'codex', { global: true })).toEqual([
      { name: SKILL, path: shared },
    ]);
  });

  it('preserves the shared copy for an unrecorded external consumer at the same path', async () => {
    const shared = '/fake/shared/create-pull-request';
    const runner = fakeSkillCli({ codex: shared, opencode: shared });
    await seedPair(runner, ['codex', 'opencode']);
    const record = buildRecord({ opencode: [SKILL] });
    const effective = resolveEffectiveSkills(
      [{ id: 'opencode' }],
      { excludeSkills: SKILL },
      record,
    );
    const outcome = await reconcileCompanions(
      runner,
      record,
      effective,
      new Map([['opencode', true]]),
      SOURCE,
    );
    expect(outcome.ok.get('opencode')).toBe(true);
    expect(outcome.notes.get('opencode')).toMatch(/still provided by 'codex'/u);
    expect(await listCompanions(runner, 'opencode', { global: true })).toEqual([
      { name: SKILL, path: shared },
    ]);
    expect(await listCompanions(runner, 'codex', { global: true })).toEqual([
      { name: SKILL, path: shared },
    ]);
  });

  it('removes the owned copy when no other consumer shares the observed path', async () => {
    const runner = fakeSkillCli({ opencode: '/fake/only-opencode/create-pull-request' });
    await addCompanion(
      runner,
      { agent: 'opencode', skill: SKILL, source: SOURCE },
      { global: true },
    );
    const record = buildRecord({ opencode: [SKILL] });
    const effective = resolveEffectiveSkills(
      [{ id: 'opencode' }],
      { excludeSkills: SKILL },
      record,
    );
    const outcome = await reconcileCompanions(
      runner,
      record,
      effective,
      new Map([['opencode', true]]),
      SOURCE,
    );
    expect(outcome.ok.get('opencode')).toBe(true);
    expect(outcome.notes.get('opencode')).toBeUndefined();
    expect(await listCompanions(runner, 'opencode', { global: true })).toEqual([]);
  });

  it('excluding an unmanaged copy performs no removal and reports it left in place', async () => {
    const present = '/fake/stray/create-pull-request';
    const runner = fakeSkillCli({ opencode: present });
    await addCompanion(
      runner,
      { agent: 'opencode', skill: SKILL, source: SOURCE },
      { global: true },
    );
    const effective = resolveEffectiveSkills([{ id: 'opencode' }], { excludeSkills: SKILL }, null);
    expect(effective[0]?.selection.skills).toEqual([DOCS]);
    const outcome = await reconcileCompanions(
      runner,
      null,
      effective,
      new Map([['opencode', true]]),
      SOURCE,
      true,
    );
    expect(outcome.ok.get('opencode')).toBe(true);
    expect(outcome.notes.get('opencode')).toMatch(/left in place/u);
    expect(await listCompanions(runner, 'opencode', { global: true })).toContainEqual({
      name: SKILL,
      path: present,
    });
    expect(await listCompanions(runner, 'opencode', { global: true })).toContainEqual({
      name: DOCS,
      path: present,
    });
  });

  it('keeps the core fallback note for unknown hosts without faking a target', async () => {
    const runner = fakeSkillCli({});
    const record = buildRecord({ watson: [] });
    const effective = resolveEffectiveSkills([{ id: 'watson' }], {}, record);
    expect(effective[0]?.selection.skills).toEqual([]);
    const outcome = await reconcileCompanions(
      runner,
      record,
      effective,
      new Map([['watson', true]]),
      SOURCE,
    );
    expect(outcome.ok.get('watson')).toBe(true);
    expect(outcome.notes.get('watson')).toMatch(/fallback/u);
  });

  it('fails explicit skill requests on unknown hosts before effects', () => {
    expect(() => resolveEffectiveSkills([{ id: 'watson' }], { skills: SKILL }, null)).toThrow(
      /no companion target/u,
    );
  });

  it('maps omp to the universal target like prime-agent', async () => {
    const { companionAgentFor, isCompanionSupported } = await import('@/lib/skill-companion.js');
    expect(companionAgentFor('omp')).toBe('universal');
    expect(companionAgentFor('prime-agent')).toBe('universal');
    expect(isCompanionSupported('omp')).toBe(true);
    const runner = fakeSkillCli({ universal: '/fake/shared/create-pull-request' });
    const effective = resolveEffectiveSkills([{ id: 'omp' }], {}, null);
    expect(effective[0]?.selection.skills).toEqual([SKILL, DOCS]);
    const outcome = await reconcileCompanions(
      runner,
      null,
      effective,
      new Map([['omp', true]]),
      SOURCE,
    );
    expect(outcome.ok.get('omp')).toBe(true);
    expect(outcome.notes.get('omp')).toBeUndefined();
    expect(await listCompanions(runner, 'universal', { global: true })).toContainEqual({
      name: SKILL,
      path: '/fake/shared/create-pull-request',
    });
  });
});

describe('reconcile uninstall companions', () => {
  it('leaves companions in place with a manual command when no record exists', async () => {
    const runner = fakeSkillCli({ [AGENT]: '/fake/p' });
    await addCompanion(runner, { agent: AGENT, skill: SKILL, source: SOURCE }, { global: true });
    const combined = await reconcileUninstallCompanions(runner, null, [
      { id: 'opencode', label: 'OpenCode', message: 'Uninstalled', ok: true },
    ]);
    expect(combined.results[0]?.ok).toBe(true);
    expect(combined.results[0]?.message).toMatch(/left in place.*manually/u);
    expect(await listCompanions(runner, AGENT, { global: true })).toHaveLength(1);
  });

  it('removes owned copies and drops only the uninstalled platform record', async () => {
    await isolateRecord();
    const runner = fakeSkillCli({ [AGENT]: '/fake/p' });
    await addCompanion(runner, { agent: AGENT, skill: SKILL, source: SOURCE }, { global: true });
    const record = buildRecord({ cursor: [SKILL], opencode: [SKILL] });
    const combined = await reconcileUninstallCompanions(runner, record, [
      { id: 'opencode', label: 'OpenCode', message: 'Uninstalled', ok: true },
    ]);
    expect(combined.results[0]?.ok).toBe(true);
    expect(await listCompanions(runner, AGENT, { global: true })).toEqual([]);
    const { readSkillsRecord } = await import('@/lib/skills.js');
    const saved = await readSkillsRecord();
    expect(saved?.platforms.opencode).toBeUndefined();
    expect(saved?.platforms.cursor?.skills).toEqual([SKILL]);
  });

  it('preserves the shared copy when another owned platform stays installed', async () => {
    const shared = '/fake/shared/create-pull-request';
    const runner = fakeSkillCli({ codex: shared, opencode: shared });
    await seedPair(runner, ['codex', 'opencode']);
    const record = buildRecord({ codex: [SKILL], opencode: [SKILL] });
    const combined = await reconcileUninstallCompanions(runner, record, [
      { id: 'opencode', label: 'OpenCode', message: 'Uninstalled', ok: true },
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
    await seedPair(runner, ['codex', 'opencode']);
    const record = buildRecord({ opencode: [SKILL] });
    const combined = await reconcileUninstallCompanions(runner, record, [
      { id: 'opencode', label: 'OpenCode', message: 'Uninstalled', ok: true },
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
    const saved = await readSkillsRecord();
    expect(saved?.platforms.opencode).toBeUndefined();
  });

  it('preserves when external inventory cannot verify exclusive ownership', async () => {
    const shared = '/fake/shared/create-pull-request';
    const base = fakeSkillCli({ opencode: shared });
    await addCompanion(base, { agent: 'opencode', skill: SKILL, source: SOURCE }, { global: true });
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
    const effective = resolveEffectiveSkills(
      [{ id: 'opencode' }],
      { excludeSkills: SKILL },
      record,
    );
    const outcome = await reconcileCompanions(
      runner,
      record,
      effective,
      new Map([['opencode', true]]),
      SOURCE,
    );
    expect(outcome.ok.get('opencode')).toBe(true);
    expect(outcome.notes.get('opencode')).toMatch(/still provided by/u);
    expect(await listCompanions(base, 'opencode', { global: true })).toEqual([
      { name: SKILL, path: shared },
    ]);
  });
});

describe('apply companion outcomes', () => {
  it('reports plugin failure accurately when the companion is also unreconciled', () => {
    const effective = resolveEffectiveSkills([{ id: 'opencode' }], {}, null);
    const combined = applyCompanionOutcomes(
      [{ id: 'opencode', label: 'OpenCode', message: 'Plugin failed', ok: false }],
      effective,
      {
        actual: new Map(),
        notes: new Map(),
        observed: new Map(),
        ok: new Map([['opencode', false]]),
      },
    );
    expect(combined[0]?.ok).toBe(false);
    expect(combined[0]?.message).toMatch(/Plugin operation failed/u);
    expect(combined[0]?.message).not.toMatch(/succeeded/u);
  });
});

describe('record roundtrip', () => {
  it('persists per-skill observed source and path and reads them back', async () => {
    await isolateRecord();
    const { readSkillsRecord, withRecordedSelection, writeSkillsRecord } =
      await import('@/lib/skills.js');
    const next = withRecordedSelection(null, 'pi', [SKILL], {
      [SKILL]: { path: '/fake/pi/create-pull-request', source: SOURCE },
    });
    await writeSkillsRecord(next);
    const text = await readFile(`${process.env.MAESTRIA_CONFIG_DIR}/skills.json`, 'utf-8');
    expect(text).toContain(SOURCE);
    const saved = await readSkillsRecord();
    expect(saved?.platforms.pi?.skills).toEqual([SKILL]);
    expect(saved?.platforms.pi?.skillAssets).toMatchObject({
      [SKILL]: { path: '/fake/pi/create-pull-request', source: SOURCE },
    });
  });

  it('keeps unknown skill history when uninstalling managed skills', async () => {
    await isolateRecord();
    const runner = fakeSkillCli({ [AGENT]: '/fake/p' });
    await addCompanion(runner, { agent: AGENT, skill: SKILL, source: SOURCE }, { global: true });
    const record = buildRecord({ opencode: [SKILL, 'future-skill'] });
    const combined = await reconcileUninstallCompanions(runner, record, [
      { id: 'opencode', label: 'OpenCode', message: 'Uninstalled', ok: true },
    ]);
    expect(combined.results[0]?.ok).toBe(true);
    expect(await listCompanions(runner, AGENT, { global: true })).toEqual([]);
    const { readSkillsRecord } = await import('@/lib/skills.js');
    const saved = await readSkillsRecord();
    expect(saved?.platforms.opencode?.skills).toEqual(['future-skill']);
  });
});
