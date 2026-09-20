import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { COMPANION_SKILL } from '@/lib/skill-companion.js';
import { defaultSkillRunner } from '@/lib/skill-reconcile.js';

/**
 * Live verification against the pinned official skills CLI in an isolated
 * sandbox (temp HOME/XDG/npm-cache, local repo `skills/` copy as source).
 * Never touches the real home directory. Runs only with
 * `MAESTRIA_REAL_SKILLS_CLI=1` so the default suite stays hermetic; the
 * task runner executes this file explicitly for runtime proof.
 *
 * Verified contract (skills@1.7.0): `add -g --json -y` confirms with a
 * trailing JSON array; `list -g --json` reports observed name/path;
 * `remove -g -y` has no JSON and is confirmed by re-listing; exit code 0 is
 * unreliable (invalid agents and absent skills also exit 0).
 */
const live = process.env.MAESTRIA_REAL_SKILLS_CLI === '1';
const maybe = live ? describe : describe.skip;

const REPO_SKILLS = path.resolve(import.meta.dirname, '..', '..', '..', 'skills');
const NPM_CACHE = path.join(tmpdir(), 'maestria-skills-cli-npm-cache');

const sandboxes: string[] = [];

const pluginOk = (id: string): Map<string, boolean> => new Map([[id, true]]);

const makeSandbox = async (): Promise<string> => {
  const root = await mkdtemp(path.join(tmpdir(), 'maestria-live-skills-'));
  sandboxes.push(root);
  vi.stubEnv('HOME', path.join(root, 'home'));
  vi.stubEnv('XDG_CONFIG_HOME', path.join(root, 'config'));
  vi.stubEnv('XDG_CACHE_HOME', path.join(root, 'cache'));
  vi.stubEnv('npm_config_cache', NPM_CACHE);
  vi.stubEnv('MAESTRIA_CONFIG_DIR', path.join(root, 'maestria-config'));
  vi.stubEnv('MAESTRIA_SKILLS_SOURCE', REPO_SKILLS);
  return root;
};

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(
    sandboxes.splice(0).map(async (dir) => {
      await rm(dir, { force: true, recursive: true });
    }),
  );
});

maybe('live skills CLI sandbox', () => {
  it('roundtrips add, list, idempotent re-add, and verified removal', async () => {
    const { addCompanion, listCompanions, removeCompanion } =
      await import('@/lib/skill-companion.js');
    await makeSandbox();
    const installed = await addCompanion(
      defaultSkillRunner,
      { agent: 'opencode', skill: COMPANION_SKILL, source: REPO_SKILLS },
      { global: true },
    );
    expect(installed.path).toContain('.agents/skills/create-pull-request');
    const listed = await listCompanions(defaultSkillRunner, 'opencode', { global: true });
    expect(listed.map((entry) => entry.name)).toContain(COMPANION_SKILL);
    await addCompanion(
      defaultSkillRunner,
      { agent: 'opencode', skill: COMPANION_SKILL, source: REPO_SKILLS },
      { global: true },
    );
    expect(
      await removeCompanion(defaultSkillRunner, { agent: 'opencode' }, { global: true }),
    ).toEqual({ removed: true });
    expect(await listCompanions(defaultSkillRunner, 'opencode', { global: true })).toEqual([]);
  }, 180_000);

  it('detects independently installed copies as unmanaged before mutation', async () => {
    const { addCompanion } = await import('@/lib/skill-companion.js');
    const { preflightCompanionOwnership, resolveEffectiveSkills } =
      await import('@/lib/skill-reconcile.js');
    await makeSandbox();
    await addCompanion(
      defaultSkillRunner,
      { agent: 'cursor', skill: COMPANION_SKILL, source: REPO_SKILLS },
      { global: true },
    );
    const effective = resolveEffectiveSkills([{ id: 'cursor' }], {}, null);
    await expect(preflightCompanionOwnership(defaultSkillRunner, null, effective)).rejects.toThrow(
      /Existing unmanaged skill/u,
    );
  }, 180_000);

  it('installs omp onto the opencode share of the universal asset without error or duplicate', async () => {
    const { listCompanions } = await import('@/lib/skill-companion.js');
    const {
      attachCompanionObserved,
      preflightCompanionOwnership,
      reconcileCompanions,
      resolveEffectiveSkills,
      resolveSkillsSource,
    } = await import('@/lib/skill-reconcile.js');
    const { persistSuccessfulSelections, readSkillsRecord } = await import('@/lib/skills.js');
    await makeSandbox();
    const source = resolveSkillsSource();

    const first = resolveEffectiveSkills([{ id: 'opencode' }], {}, null);
    await preflightCompanionOwnership(defaultSkillRunner, null, first);
    const firstOutcome = await reconcileCompanions(
      defaultSkillRunner,
      null,
      first,
      pluginOk('opencode'),
      source,
    );
    expect(firstOutcome.ok.get('opencode')).toBe(true);
    await persistSuccessfulSelections(
      null,
      attachCompanionObserved(first, firstOutcome),
      [{ id: 'opencode', ok: true }],
      false,
    );
    const record = await readSkillsRecord();
    expect(record?.platforms.opencode?.path).toContain('.agents/skills/create-pull-request');
    expect(record?.platforms.opencode?.source).toBe(source);

    const second = resolveEffectiveSkills([{ id: 'omp' }], {}, record);
    await preflightCompanionOwnership(defaultSkillRunner, record, second);
    const secondOutcome = await reconcileCompanions(
      defaultSkillRunner,
      record,
      second,
      pluginOk('omp'),
      source,
    );
    expect(secondOutcome.ok.get('omp')).toBe(true);
    const universal = await listCompanions(defaultSkillRunner, 'universal', { global: true });
    expect(universal.filter((entry) => entry.name === COMPANION_SKILL)).toHaveLength(1);
  }, 180_000);

  it('excluding omp leaves the opencode share of the universal asset intact', async () => {
    const { addCompanion, listCompanions } = await import('@/lib/skill-companion.js');
    const { reconcileCompanions, resolveEffectiveSkills } =
      await import('@/lib/skill-reconcile.js');
    const { parseSkillsRecord } = await import('@/lib/skills.js');
    await makeSandbox();
    for (const agent of ['opencode', 'universal']) {
      // oxlint-disable-next-line no-await-in-loop -- sequential installs keep shared-path order deterministic.
      await addCompanion(
        defaultSkillRunner,
        { agent, skill: COMPANION_SKILL, source: REPO_SKILLS },
        { global: true },
      );
    }
    const [listed] = await listCompanions(defaultSkillRunner, 'universal', { global: true });
    const record = parseSkillsRecord(
      JSON.stringify({
        platforms: {
          omp: { path: listed?.path, skills: [COMPANION_SKILL], source: REPO_SKILLS },
          opencode: { path: listed?.path, skills: [COMPANION_SKILL], source: REPO_SKILLS },
        },
        version: 1,
      }),
      'live-test',
    );
    const effective = resolveEffectiveSkills(
      [{ id: 'omp' }],
      { excludeSkills: COMPANION_SKILL },
      record,
    );
    const outcome = await reconcileCompanions(
      defaultSkillRunner,
      record,
      effective,
      new Map([['omp', true]]),
      REPO_SKILLS,
    );
    expect(outcome.ok.get('omp')).toBe(true);
    expect(outcome.notes.get('omp')).toMatch(/still provided by 'opencode'/u);
    const remaining = await listCompanions(defaultSkillRunner, 'opencode', { global: true });
    expect(remaining.map((entry) => entry.name)).toContain(COMPANION_SKILL);
  }, 180_000);

  it('excluding an unmanaged copy performs no removal', async () => {
    const { addCompanion, listCompanions } = await import('@/lib/skill-companion.js');
    const { reconcileCompanions, resolveEffectiveSkills } =
      await import('@/lib/skill-reconcile.js');
    await makeSandbox();
    await addCompanion(
      defaultSkillRunner,
      { agent: 'universal', skill: COMPANION_SKILL, source: REPO_SKILLS },
      { global: true },
    );
    const before = await listCompanions(defaultSkillRunner, 'universal', { global: true });
    expect(before.map((entry) => entry.name)).toContain(COMPANION_SKILL);
    const effective = resolveEffectiveSkills(
      [{ id: 'omp' }],
      { excludeSkills: COMPANION_SKILL },
      null,
    );
    const outcome = await reconcileCompanions(
      defaultSkillRunner,
      null,
      effective,
      new Map([['omp', true]]),
      REPO_SKILLS,
      true,
    );
    expect(outcome.ok.get('omp')).toBe(true);
    expect(outcome.notes.get('omp')).toMatch(/left in place/u);
    const after = await listCompanions(defaultSkillRunner, 'universal', { global: true });
    expect(after.map((entry) => entry.name)).toContain(COMPANION_SKILL);
  }, 180_000);

  it('preserves the shared copy while another owned platform stays installed', async () => {
    const { addCompanion, listCompanions } = await import('@/lib/skill-companion.js');
    const { reconcileUninstallCompanions } = await import('@/lib/skill-reconcile.js');
    const { parseSkillsRecord } = await import('@/lib/skills.js');
    await makeSandbox();
    for (const agent of ['codex', 'opencode']) {
      // oxlint-disable-next-line no-await-in-loop -- sequential installs keep shared-path order deterministic.
      await addCompanion(
        defaultSkillRunner,
        { agent, skill: COMPANION_SKILL, source: REPO_SKILLS },
        { global: true },
      );
    }
    const record = parseSkillsRecord(
      JSON.stringify({
        platforms: {
          codex: { skills: [COMPANION_SKILL] },
          opencode: { skills: [COMPANION_SKILL] },
        },
        version: 1,
      }),
      'live-test',
    );
    const combined = await reconcileUninstallCompanions(defaultSkillRunner, record, [
      { id: 'opencode', label: 'OpenCode', message: 'Uninstalled', ok: true },
    ]);
    expect(combined.results[0]?.ok).toBe(true);
    expect(combined.results[0]?.message).toMatch(/still provided by 'codex'/u);
    const remaining = await listCompanions(defaultSkillRunner, 'codex', { global: true });
    expect(remaining.map((entry) => entry.name)).toContain(COMPANION_SKILL);
  }, 180_000);
});
