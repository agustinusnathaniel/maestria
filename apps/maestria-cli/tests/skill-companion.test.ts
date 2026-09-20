import { mkdtempSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { CliError } from '@/lib/command-result.js';
import {
  addCompanion,
  COMPANION_SKILL,
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
import { parseSkillsRecord } from '@/lib/skills.js';
import type { SkillsRecord } from '@/lib/skills.js';

const SKILL = COMPANION_SKILL;
const SOURCE = 'test-source';
const AGENT = 'opencode';

const addJson = (agent: string, skillPath: string, status = 'installed'): string =>
  [
    'Installation Summary',
    `  ${skillPath}`,
    '',
    JSON.stringify([
      { agents: ['OpenCode'], mode: 'copy', name: SKILL, path: skillPath, scope: 'global', status },
    ]),
  ].join('\n');

const listJson = (entries: { name: string; path: string }[]): string =>
  JSON.stringify(entries.map((entry) => ({ ...entry, scope: 'global' })));

/**
 * Observable fake of the external skills CLI: keeps per-agent installed
 * inventory and renders the same machine shapes the real CLI produces
 * (trailing JSON for add/list, human text for remove). No filesystem
 * assertions about target paths: identity flows through tool output only.
 */
const fakeCli = (paths: Record<string, string>): SkillCommandRunner => {
  const installed = new Map<string, { name: string; path: string }[]>();
  // oxlint-disable-next-line require-await -- synchronous fake runner by design.
  return async (args: readonly string[]) => {
    const agentFlag = args.indexOf('-a');
    const agent = agentFlag === -1 ? '' : (args[agentFlag + 1] ?? '');
    const [command] = args;
    if (command === 'add') {
      const list = installed.get(agent) ?? [];
      if (!list.some((entry) => entry.name === SKILL)) {
        list.push({ name: SKILL, path: paths[agent] ?? `/fake/${agent}/${SKILL}` });
      }
      installed.set(agent, list);
      const current = installed.get(agent) ?? [];
      return { stderr: '', stdout: addJson(agent, current[0]?.path ?? '') };
    }
    if (command === 'list') {
      return { stderr: '', stdout: listJson(installed.get(agent) ?? []) };
    }
    if (command === 'remove') {
      const list = installed.get(agent) ?? [];
      const kept = list.filter((entry) => entry.name !== SKILL);
      installed.set(agent, kept);
      return {
        stderr: '',
        stdout: kept.length === list.length ? 'No skills found to remove.' : 'Done!',
      };
    }
    throw new Error(`unexpected fake command: ${command}`);
  };
};

const staticRunner =
  (stdout: string): SkillCommandRunner =>
  // oxlint-disable-next-line require-await -- synchronous fake runner by design.
  async () => ({ stderr: '', stdout });

type RecordEntry = string[] | { path?: string; skills: string[]; source?: string };

const recordWith = (platforms: Record<string, RecordEntry>): SkillsRecord =>
  parseSkillsRecord(
    JSON.stringify({
      platforms: Object.fromEntries(
        Object.entries(platforms).map(([id, entry]) => [
          id,
          Array.isArray(entry) ? { skills: entry } : entry,
        ]),
      ),
      version: 1,
    }),
    'test',
  );

const configDirs: string[] = [];

beforeEach(() => {
  vi.stubEnv('MAESTRIA_SKILLS_SOURCE', SOURCE);
  // Default every test to an isolated record dir so no test can touch the
  // real user config; isolateRecord() re-points per test when it must read back.
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
    const runner = fakeCli({ [AGENT]: '/fake/home/.agents/skills/create-pull-request' });
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
    const runner = fakeCli({ [AGENT]: '/fake/home/.agents/skills/create-pull-request' });
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
    const record = recordWith({ [AGENT]: [SKILL] });
    const effective = resolveEffectiveSkills([{ id: 'opencode' }], {}, record);
    await preflightCompanionOwnership(runner, record, effective);
    expect(seen).toEqual([]);
  });

  it('aborts on unmanaged copies with the exclude-or-remove guidance', async () => {
    const runner = fakeCli({ [AGENT]: '/observed/.agents/skills/create-pull-request' });
    await addCompanion(runner, { agent: AGENT, skill: SKILL, source: SOURCE }, { global: true });
    const effective = resolveEffectiveSkills([{ id: 'opencode' }], {}, null);
    await expect(preflightCompanionOwnership(runner, null, effective)).rejects.toThrow(
      /Existing unmanaged skill.*--exclude-skills/u,
    );
  });

  it('passes fresh installs with nothing listed', async () => {
    const runner = fakeCli({});
    const effective = resolveEffectiveSkills([{ id: 'opencode' }], {}, null);
    await preflightCompanionOwnership(runner, null, effective);
  });

  it('never checks targets selected for exclusion', async () => {
    const seen: string[][] = [];
    // oxlint-disable-next-line require-await -- synchronous fake runner by design.
    const runner: SkillCommandRunner = async (args: readonly string[]) => {
      seen.push([...args]);
      return { stderr: '', stdout: '[]' };
    };
    const record = recordWith({ [AGENT]: [SKILL] });
    const effective = resolveEffectiveSkills(
      [{ id: 'opencode' }],
      { excludeSkills: SKILL },
      record,
    );
    await preflightCompanionOwnership(runner, record, effective);
    expect(seen).toEqual([]);
  });

  it('allows a new platform when the observed path matches a recorded asset from the same source', async () => {
    const shared = '/fake/shared/create-pull-request';
    const runner = fakeCli({ opencode: shared, universal: shared });
    for (const agent of ['opencode', 'universal']) {
      // oxlint-disable-next-line no-await-in-loop -- shared canonical dir is visible under both agent IDs.
      await addCompanion(runner, { agent, skill: SKILL, source: SOURCE }, { global: true });
    }
    const record = recordWith({
      opencode: { path: shared, skills: [SKILL], source: SOURCE },
    });
    const effective = resolveEffectiveSkills([{ id: 'omp' }], {}, record);
    await preflightCompanionOwnership(runner, record, effective, SOURCE);
  });

  it('rejects when the observed path matches a recorded asset from another source', async () => {
    const shared = '/fake/shared/create-pull-request';
    const runner = fakeCli({ opencode: shared, universal: shared });
    for (const agent of ['opencode', 'universal']) {
      // oxlint-disable-next-line no-await-in-loop -- shared canonical dir is visible under both agent IDs.
      await addCompanion(runner, { agent, skill: SKILL, source: SOURCE }, { global: true });
    }
    const record = recordWith({
      opencode: { path: shared, skills: [SKILL], source: 'other-source' },
    });
    const effective = resolveEffectiveSkills([{ id: 'omp' }], {}, record);
    await expect(preflightCompanionOwnership(runner, record, effective, SOURCE)).rejects.toThrow(
      /Existing unmanaged skill/u,
    );
  });

  it('rejects an independent copy at a path no record claims', async () => {
    const runner = fakeCli({ universal: '/fake/stray/create-pull-request' });
    await addCompanion(
      runner,
      { agent: 'universal', skill: SKILL, source: SOURCE },
      { global: true },
    );
    const record = recordWith({
      opencode: { path: '/fake/shared/create-pull-request', skills: [SKILL], source: SOURCE },
    });
    const effective = resolveEffectiveSkills([{ id: 'omp' }], {}, record);
    await expect(preflightCompanionOwnership(runner, record, effective, SOURCE)).rejects.toThrow(
      /Existing unmanaged skill/u,
    );
  });

  it('installs a second platform onto the same asset without error or duplicate copy', async () => {
    const shared = '/fake/shared/create-pull-request';
    const runner = fakeCli({ opencode: shared, universal: shared });
    await addCompanion(
      runner,
      { agent: 'opencode', skill: SKILL, source: SOURCE },
      { global: true },
    );
    const record = recordWith({
      opencode: { path: shared, skills: [SKILL], source: SOURCE },
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
    expect(await listCompanions(runner, 'universal', { global: true })).toEqual([
      { name: SKILL, path: shared },
    ]);
  });
});

describe('reconcile companions', () => {
  it('adds selected skills and records the observed source and path', async () => {
    await isolateRecord();
    const runner = fakeCli({ [AGENT]: '/fake/shared/create-pull-request' });
    const { writeSkillsRecord } = await import('@/lib/skills.js');
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
    expect(outcome.ok.get('opencode')).toBe(true);
    await persistSuccessfulSelections(
      null,
      attachCompanionObserved(effective, outcome),
      [{ id: 'opencode', ok: true }],
      false,
    );
    const { readSkillsRecord } = await import('@/lib/skills.js');
    const saved = await readSkillsRecord();
    expect(saved?.platforms.opencode?.skills).toEqual([SKILL]);
    expect(saved?.platforms.opencode?.source).toBe(SOURCE);
    expect(saved?.platforms.opencode?.path).toBe('/fake/shared/create-pull-request');
    await writeSkillsRecord(saved ?? { platforms: {}, version: 1 });
  });

  it('preserves shared copies while another owned platform stays active', async () => {
    const shared = '/fake/shared/create-pull-request';
    const runner = fakeCli({ codex: shared, opencode: shared });
    await addCompanion(runner, { agent: 'codex', skill: SKILL, source: SOURCE }, { global: true });
    await addCompanion(
      runner,
      { agent: 'opencode', skill: SKILL, source: SOURCE },
      { global: true },
    );
    const record = recordWith({ codex: [SKILL], opencode: [SKILL] });
    const effective = resolveEffectiveSkills(
      [{ id: 'codex' }, { id: 'opencode' }],
      { excludeSkills: SKILL },
      record,
    );
    // Both drop in the same run: no stayer, so both removes proceed honestly.
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
    // Second removal is an absent no-op after the first deleted the shared dir.
    expect(await listCompanions(runner, 'codex', { global: true })).toEqual([]);
  });

  it('skips removal for one platform when the other stays on the shared path', async () => {
    const shared = '/fake/shared/create-pull-request';
    const runner = fakeCli({ codex: shared, opencode: shared });
    await addCompanion(runner, { agent: 'codex', skill: SKILL, source: SOURCE }, { global: true });
    await addCompanion(
      runner,
      { agent: 'opencode', skill: SKILL, source: SOURCE },
      { global: true },
    );
    const staying = recordWith({ codex: [SKILL], opencode: [SKILL] });
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
    const runner = fakeCli({ codex: shared, opencode: shared });
    await addCompanion(runner, { agent: 'codex', skill: SKILL, source: SOURCE }, { global: true });
    await addCompanion(
      runner,
      { agent: 'opencode', skill: SKILL, source: SOURCE },
      { global: true },
    );
    // Record owns opencode only; codex is independently installed with no entry.
    const record = recordWith({ opencode: [SKILL] });
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
    const runner = fakeCli({ opencode: '/fake/only-opencode/create-pull-request' });
    await addCompanion(
      runner,
      { agent: 'opencode', skill: SKILL, source: SOURCE },
      { global: true },
    );
    const record = recordWith({ opencode: [SKILL] });
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

  it('excluding omp leaves the opencode share of the universal asset intact', async () => {
    const shared = '/fake/shared/create-pull-request';
    const runner = fakeCli({ opencode: shared, universal: shared });
    await addCompanion(
      runner,
      { agent: 'opencode', skill: SKILL, source: SOURCE },
      { global: true },
    );
    await addCompanion(
      runner,
      { agent: 'universal', skill: SKILL, source: SOURCE },
      { global: true },
    );
    const record = recordWith({
      omp: { path: shared, skills: [SKILL], source: SOURCE },
      opencode: { path: shared, skills: [SKILL], source: SOURCE },
    });
    const effective = resolveEffectiveSkills([{ id: 'omp' }], { excludeSkills: SKILL }, record);
    const outcome = await reconcileCompanions(
      runner,
      record,
      effective,
      new Map([['omp', true]]),
      SOURCE,
    );
    expect(outcome.ok.get('omp')).toBe(true);
    expect(outcome.notes.get('omp')).toMatch(/still provided by 'opencode'/u);
    expect(await listCompanions(runner, 'opencode', { global: true })).toEqual([
      { name: SKILL, path: shared },
    ]);
  });

  it('excluding an unmanaged copy performs no removal and reports it left in place', async () => {
    const present = '/fake/stray/create-pull-request';
    const runner = fakeCli({ opencode: present });
    await addCompanion(
      runner,
      { agent: 'opencode', skill: SKILL, source: SOURCE },
      { global: true },
    );
    const effective = resolveEffectiveSkills([{ id: 'opencode' }], { excludeSkills: SKILL }, null);
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
    expect(await listCompanions(runner, 'opencode', { global: true })).toEqual([
      { name: SKILL, path: present },
    ]);
  });

  it('keeps the core fallback note for unknown hosts without faking a target', async () => {
    const runner = fakeCli({});
    const record = recordWith({ watson: [] });
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
    const runner = fakeCli({ universal: '/fake/shared/create-pull-request' });
    const effective = resolveEffectiveSkills([{ id: 'omp' }], {}, null);
    expect(effective[0]?.selection.skills).toEqual([SKILL]);
    const outcome = await reconcileCompanions(
      runner,
      null,
      effective,
      new Map([['omp', true]]),
      SOURCE,
    );
    expect(outcome.ok.get('omp')).toBe(true);
    expect(outcome.notes.get('omp')).toBeUndefined();
    expect(await listCompanions(runner, 'universal', { global: true })).toEqual([
      { name: SKILL, path: '/fake/shared/create-pull-request' },
    ]);
  });
});

describe('reconcile uninstall companions', () => {
  it('leaves companions in place with a manual command when no record exists', async () => {
    const runner = fakeCli({ [AGENT]: '/fake/p' });
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
    const runner = fakeCli({ [AGENT]: '/fake/p' });
    await addCompanion(runner, { agent: AGENT, skill: SKILL, source: SOURCE }, { global: true });
    const record = recordWith({ cursor: [SKILL], opencode: [SKILL] });
    const combined = await reconcileUninstallCompanions(runner, record, [
      { id: 'opencode', label: 'OpenCode', message: 'Uninstalled', ok: true },
    ]);
    // cursor stays active on a different observed path, so removal proceeds.
    expect(combined.results[0]?.ok).toBe(true);
    expect(await listCompanions(runner, AGENT, { global: true })).toEqual([]);
    const { readSkillsRecord } = await import('@/lib/skills.js');
    const saved = await readSkillsRecord();
    expect(saved?.platforms.opencode).toBeUndefined();
    expect(saved?.platforms.cursor?.skills).toEqual([SKILL]);
  });

  it('preserves the shared copy when another owned platform stays installed', async () => {
    const shared = '/fake/shared/create-pull-request';
    const runner = fakeCli({ codex: shared, opencode: shared });
    await addCompanion(runner, { agent: 'codex', skill: SKILL, source: SOURCE }, { global: true });
    await addCompanion(
      runner,
      { agent: 'opencode', skill: SKILL, source: SOURCE },
      { global: true },
    );
    const record = recordWith({ codex: [SKILL], opencode: [SKILL] });
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
    const runner = fakeCli({ codex: shared, opencode: shared });
    await addCompanion(runner, { agent: 'codex', skill: SKILL, source: SOURCE }, { global: true });
    await addCompanion(
      runner,
      { agent: 'opencode', skill: SKILL, source: SOURCE },
      { global: true },
    );
    const record = recordWith({ opencode: [SKILL] });
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
    const base = fakeCli({ opencode: shared });
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
    const record = recordWith({ opencode: [SKILL] });
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
      { notes: new Map(), observed: new Map(), ok: new Map([['opencode', false]]) },
    );
    expect(combined[0]?.ok).toBe(false);
    expect(combined[0]?.message).toMatch(/Plugin operation failed/u);
    expect(combined[0]?.message).not.toMatch(/succeeded/u);
  });
});

describe('record roundtrip', () => {
  it('persists observed source and path and reads them back', async () => {
    await isolateRecord();
    const { readSkillsRecord, withRecordedSelection, writeSkillsRecord } =
      await import('@/lib/skills.js');
    const next = withRecordedSelection(null, 'pi', [SKILL], {
      path: '/fake/pi/create-pull-request',
      source: SOURCE,
    });
    await writeSkillsRecord(next);
    const text = await readFile(`${process.env.MAESTRIA_CONFIG_DIR}/skills.json`, 'utf-8');
    expect(text).toContain(SOURCE);
    const saved = await readSkillsRecord();
    expect(saved?.platforms.pi).toMatchObject({
      path: '/fake/pi/create-pull-request',
      skills: [SKILL],
      source: SOURCE,
    });
  });
});
