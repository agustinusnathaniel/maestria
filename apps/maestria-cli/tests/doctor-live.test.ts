import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

/** Live list-only verification for doctor in an isolated sandbox. */
const live = process.env.MAESTRIA_REAL_SKILLS_CLI === '1';
const maybe = live ? describe : describe.skip;

const NPM_CACHE = path.join(tmpdir(), 'maestria-skills-cli-npm-cache');

const sandboxes: string[] = [];

const makeSandbox = async (): Promise<void> => {
  const root = await mkdtemp(path.join(tmpdir(), 'maestria-live-doctor-'));
  sandboxes.push(root);
  vi.stubEnv('HOME', path.join(root, 'home'));
  vi.stubEnv('XDG_CONFIG_HOME', path.join(root, 'config'));
  vi.stubEnv('XDG_CACHE_HOME', path.join(root, 'cache'));
  vi.stubEnv('npm_config_cache', NPM_CACHE);
  vi.stubEnv('MAESTRIA_CONFIG_DIR', path.join(root, 'maestria-config'));
};

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(
    sandboxes.splice(0).map(async (dir) => {
      await rm(dir, { force: true, recursive: true });
    }),
  );
});

maybe('live doctor list observation', () => {
  it('observes empty inventory read-only with no record writes', async () => {
    const { listCompanions } = await import('@/lib/skill-companion.js');
    const { collectDoctorReports } = await import('@/lib/doctor.js');
    const { defaultSkillRunner } = await import('@/lib/skill-reconcile.js');
    const { getSkillsRecordPath } = await import('@/lib/skills.js');
    const { existsSync } = await import('node:fs');
    await makeSandbox();
    const recordPath = getSkillsRecordPath();
    expect(recordPath).toContain('maestria-live-doctor-');
    const listed = await listCompanions(defaultSkillRunner, 'opencode', { global: true });
    expect(listed).toEqual([]);
    const reports = await collectDoctorReports(
      defaultSkillRunner,
      [
        {
          available: true,
          id: 'opencode',
          installed: false,
          installedVersion: '',
          label: 'OpenCode',
          latestVersion: '',
        },
      ],
      null,
    );
    expect(reports).toHaveLength(1);
    expect(reports[0]?.observed).toEqual([]);
    expect(existsSync(recordPath)).toBe(false);
  }, 180_000);
});
