import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { COMPANION_SKILL, DOCS_UPDATE_SKILL } from '@/lib/skill-companion.js';
import { defaultSkillRunner } from '@/lib/skill-reconcile.js';

/**
 * Live verification against the pinned official skills CLI in an isolated
 * sandbox. Runs only with `MAESTRIA_REAL_SKILLS_CLI=1` so the default suite
 * stays hermetic.
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
    expect(record?.platforms.opencode?.skillAssets?.[COMPANION_SKILL]?.path).toContain(
      '.agents/skills/create-pull-request',
    );
    expect(record?.platforms.opencode?.skillAssets?.[COMPANION_SKILL]?.source).toBe(source);

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

  it('installs docs-update by default, then removes each skill independently', async () => {
    const { listCompanions, removeCompanion } = await import('@/lib/skill-companion.js');
    const { reconcileCompanions, resolveEffectiveSkills, resolveSkillsSource } =
      await import('@/lib/skill-reconcile.js');
    const { parseSkillsRecord } = await import('@/lib/skills.js');
    await makeSandbox();
    const source = resolveSkillsSource();
    const entries = await readdir(source);
    expect(entries).toContain(COMPANION_SKILL);
    expect(entries).toContain(DOCS_UPDATE_SKILL);

    const fresh = resolveEffectiveSkills([{ id: 'opencode' }], {}, null);
    expect(fresh[0]?.selection.skills).toEqual([COMPANION_SKILL, DOCS_UPDATE_SKILL]);
    const outcome = await reconcileCompanions(
      defaultSkillRunner,
      null,
      fresh,
      pluginOk('opencode'),
      source,
    );
    expect(outcome.ok.get('opencode')).toBe(true);
    const listed = await listCompanions(defaultSkillRunner, 'opencode', { global: true });
    expect(listed.map((entry) => entry.name)).toEqual(
      expect.arrayContaining([COMPANION_SKILL, DOCS_UPDATE_SKILL]),
    );

    const record = parseSkillsRecord(
      JSON.stringify({
        platforms: { opencode: { skills: [COMPANION_SKILL, DOCS_UPDATE_SKILL] } },
        version: 2,
      }),
      'live-test',
    );
    const narrowed = resolveEffectiveSkills(
      [{ id: 'opencode' }],
      { excludeSkills: DOCS_UPDATE_SKILL },
      record,
    );
    expect(narrowed[0]?.selection.skills).toEqual([COMPANION_SKILL]);
    const narrowedOutcome = await reconcileCompanions(
      defaultSkillRunner,
      record,
      narrowed,
      pluginOk('opencode'),
      source,
    );
    expect(narrowedOutcome.ok.get('opencode')).toBe(true);
    expect(narrowedOutcome.notes.get('opencode')).toMatch(/Skill 'docs-update' left in place/u);
    const remaining = await listCompanions(defaultSkillRunner, 'opencode', { global: true });
    expect(remaining.map((entry) => entry.name)).toContain(COMPANION_SKILL);

    await removeCompanion(
      defaultSkillRunner,
      { agent: 'opencode', skill: DOCS_UPDATE_SKILL },
      { global: true },
    );
    const withoutDocs = await listCompanions(defaultSkillRunner, 'opencode', { global: true });
    expect(withoutDocs.map((entry) => entry.name)).not.toContain(DOCS_UPDATE_SKILL);
    expect(withoutDocs.map((entry) => entry.name)).toContain(COMPANION_SKILL);

    await removeCompanion(
      defaultSkillRunner,
      { agent: 'opencode', skill: COMPANION_SKILL },
      { global: true },
    );
    expect(await listCompanions(defaultSkillRunner, 'opencode', { global: true })).toEqual([]);
  }, 180_000);
});
