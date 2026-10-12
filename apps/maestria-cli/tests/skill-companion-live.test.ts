import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { COMPANION_SKILL, DOCS_UPDATE_SKILL } from '@/lib/skill-companion.js';
import { defaultSkillRunner, removeLegacyCompanions } from '@/lib/skill-reconcile.js';

/**
 * Live verification against the pinned official skills CLI in an isolated
 * sandbox. Runs only with `MAESTRIA_REAL_SKILLS_CLI=1` so the default suite
 * stays hermetic. The CLI never installs skills; these tests seed copies
 * through raw runner calls only to verify list, verified removal, and the
 * legacy cleanup.
 */
const live = process.env.MAESTRIA_REAL_SKILLS_CLI === '1';
const maybe = live ? describe : describe.skip;

const REPO_SKILLS = path.resolve(import.meta.dirname, '..', '..', '..', 'skills');
const NPM_CACHE = path.join(tmpdir(), 'maestria-skills-cli-npm-cache');

const sandboxes: string[] = [];

const makeSandbox = async (): Promise<string> => {
  const root = await mkdtemp(path.join(tmpdir(), 'maestria-live-skills-'));
  sandboxes.push(root);
  vi.stubEnv('HOME', path.join(root, 'home'));
  vi.stubEnv('XDG_CONFIG_HOME', path.join(root, 'config'));
  vi.stubEnv('XDG_CACHE_HOME', path.join(root, 'cache'));
  vi.stubEnv('npm_config_cache', NPM_CACHE);
  vi.stubEnv('MAESTRIA_CONFIG_DIR', path.join(root, 'maestria-config'));
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
  it('lists a seeded copy and verifies removal by re-listing', async () => {
    const { listCompanions, removeCompanion } = await import('@/lib/skill-companion.js');
    await makeSandbox();
    await defaultSkillRunner([
      'add',
      REPO_SKILLS,
      '-a',
      'opencode',
      '-s',
      COMPANION_SKILL,
      '-g',
      '--json',
      '-y',
    ]);
    const listed = await listCompanions(defaultSkillRunner, 'opencode', { global: true });
    expect(listed.map((entry) => entry.name)).toContain(COMPANION_SKILL);
    expect(
      await removeCompanion(
        defaultSkillRunner,
        { agent: 'opencode', skill: COMPANION_SKILL },
        { global: true },
      ),
    ).toEqual({ removed: true });
    expect(await listCompanions(defaultSkillRunner, 'opencode', { global: true })).toEqual([]);
  }, 180_000);

  it('removes recorded legacy copies and drops the record entry', async () => {
    const { listCompanions } = await import('@/lib/skill-companion.js');
    const { readSkillsRecord, writeSkillsRecord } = await import('@/lib/skills.js');
    await makeSandbox();
    await defaultSkillRunner([
      'add',
      REPO_SKILLS,
      '-a',
      'opencode',
      '-s',
      COMPANION_SKILL,
      '-g',
      '--json',
      '-y',
    ]);
    await defaultSkillRunner([
      'add',
      REPO_SKILLS,
      '-a',
      'opencode',
      '-s',
      DOCS_UPDATE_SKILL,
      '-g',
      '--json',
      '-y',
    ]);
    await writeSkillsRecord({
      platforms: { opencode: { skills: [COMPANION_SKILL, DOCS_UPDATE_SKILL] } },
      version: 2,
    });
    const record = await readSkillsRecord();
    const combined = await removeLegacyCompanions(
      defaultSkillRunner,
      record,
      [{ id: 'opencode', label: 'OpenCode', message: 'Updated', ok: true }],
      { silentWhenUnrecorded: true },
    );
    expect(combined.results[0]?.ok).toBe(true);
    expect(await listCompanions(defaultSkillRunner, 'opencode', { global: true })).toEqual([]);
    const savedRecord = await readSkillsRecord();
    expect(savedRecord?.platforms.opencode).toBeUndefined();
  }, 180_000);
});
