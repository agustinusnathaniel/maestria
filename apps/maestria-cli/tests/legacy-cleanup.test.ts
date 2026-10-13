// oxlint-disable require-await -- test fakes match async dependency signatures synchronously by design.
import { Effect } from 'effect';
import { mkdtempSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCommand } from 'citty';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { handleUninstall } from '@/commands/uninstall.js';
import { handleUpdate } from '@/commands/update.js';
import { CliError } from '@/lib/command-result.js';
import type * as skillCompanion from '@/lib/skill-companion.js';
import { readSkillsRecord } from '@/lib/skills.js';
import type { PlatformHandler } from '@/lib/platforms.js';
import type { PlatformResult } from '@/types.js';
import { fakeSkillCli } from './skill-test-support.js';

type SkillCommandRunner = skillCompanion.SkillCommandRunner;

const COMPANION_SKILL = 'create-pull-request';
const DOCS_UPDATE_SKILL = 'docs-update';

const skillTransport = vi.hoisted(() => ({
  calls: [] as string[][],
  current: null as SkillCommandRunner | null,
}));

vi.mock('@/lib/skill-companion.js', async (importOriginal) => {
  const actual = await importOriginal<typeof skillCompanion>();
  const runSkillsCli: SkillCommandRunner = async (args, options) => {
    skillTransport.calls.push([...args]);
    const runner = skillTransport.current;
    if (runner === null) {
      throw new Error('legacy cleanup test forgot to seed the skill transport');
    }
    return await runner(args, options);
  };
  return { ...actual, runSkillsCli };
});

vi.mock('@/lib/platform-transaction.js', () => ({
  installOne: (platform: PlatformHandler): Effect.Effect<PlatformResult> =>
    Effect.succeed({ id: platform.id, label: platform.label, message: 'Installed', ok: true }),
  uninstallOne: (platform: PlatformHandler): Effect.Effect<PlatformResult> =>
    Effect.succeed({ id: platform.id, label: platform.label, message: 'Uninstalled', ok: true }),
  updateOne: (platform: PlatformHandler): Effect.Effect<PlatformResult> =>
    Effect.succeed({ id: platform.id, label: platform.label, message: 'Updated', ok: true }),
}));

const configDirs: string[] = [];

const seedRecord = async (platforms: Record<string, string[]>): Promise<void> => {
  const { writeSkillsRecord } = await import('@/lib/skills.js');
  await writeSkillsRecord({
    platforms: Object.fromEntries(
      Object.entries(platforms).map(([id, skills]) => [id, { skills }]),
    ),
    version: 2,
  });
};

const seedInstalled = async (
  runner: SkillCommandRunner,
  entries: readonly { agent: string; skill: string }[],
): Promise<void> => {
  for (const { agent, skill } of entries) {
    // oxlint-disable-next-line no-await-in-loop -- sequential seeding keeps fake inventory order deterministic.
    await runner(['add', 'test-source', '-a', agent, '-s', skill, '-g', '--json', '-y']);
  }
  skillTransport.calls.length = 0;
};

const removeCallsFor = (agent: string): string[][] =>
  skillTransport.calls.filter((args) => args[0] === 'remove' && args.includes(agent));

describe('legacy companion cleanup migration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const dir = mkdtempSync(path.join(tmpdir(), 'maestria-legacy-cleanup-'));
    configDirs.push(dir);
    vi.stubEnv('MAESTRIA_CONFIG_DIR', dir);
    skillTransport.calls.length = 0;
    skillTransport.current = null;
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    await Promise.all(
      configDirs.splice(0).map(async (dir) => {
        await rm(dir, { force: true, recursive: true });
      }),
    );
  });

  it('update removes recorded legacy copies and drops the record entry while keeping unrecorded copies', async () => {
    await seedRecord({ opencode: [COMPANION_SKILL, DOCS_UPDATE_SKILL] });
    const runner = fakeSkillCli({});
    skillTransport.current = runner;
    await seedInstalled(runner, [
      { agent: 'opencode', skill: COMPANION_SKILL },
      { agent: 'opencode', skill: DOCS_UPDATE_SKILL },
      { agent: 'cursor', skill: DOCS_UPDATE_SKILL },
    ]);

    const result = await handleUpdate({ platform: 'opencode', quiet: true });

    expect(result.exitCode).toBe(0);
    const removed = removeCallsFor('opencode').map((args) => args[1]);
    expect(removed?.toSorted()).toEqual([COMPANION_SKILL, DOCS_UPDATE_SKILL].toSorted());
    for (const call of removeCallsFor('opencode')) {
      expect(call).toContain('-g');
      expect(call).toContain('-y');
    }
    expect(removeCallsFor('cursor')).toEqual([]);
    const { listCompanions } = await import('@/lib/skill-companion.js');
    expect(await listCompanions(runner, 'cursor', { global: true })).toHaveLength(1);
    expect(await listCompanions(runner, 'opencode', { global: true })).toEqual([]);
    const record = await readSkillsRecord();
    expect(record?.platforms.opencode).toBeUndefined();
  });

  it('uninstall still removes recorded copies', async () => {
    await seedRecord({ opencode: [COMPANION_SKILL] });
    const runner = fakeSkillCli({});
    skillTransport.current = runner;
    await seedInstalled(runner, [{ agent: 'opencode', skill: COMPANION_SKILL }]);

    const result = await handleUninstall({ platform: 'opencode', quiet: true });

    expect(result.exitCode).toBe(0);
    expect(removeCallsFor('opencode').map((args) => args[1])).toEqual([COMPANION_SKILL]);
    const record = await readSkillsRecord();
    expect(record?.platforms.opencode).toBeUndefined();
  });

  it.each([
    { args: { platform: 'opencode', skills: 'none' }, command: 'install' as const },
    {
      args: { excludeSkills: DOCS_UPDATE_SKILL, platform: 'opencode' },
      command: 'update' as const,
    },
  ])('rejects the removed $command skill flag before any effect', async ({ args, command }) => {
    skillTransport.current = fakeSkillCli({});
    const rejection = await (async () => {
      try {
        if (command === 'install') {
          const { handleInstall } = await import('@/commands/install.js');
          await handleInstall(args);
        } else {
          await handleUpdate(args);
        }
      } catch (error) {
        if (error instanceof CliError) {
          return error;
        }
        throw error;
      }
      throw new Error(`Expected ${command} to throw CliError`);
    })();
    expect(rejection.exitCode).toBe(1);
    expect(rejection.message).toMatch(/bundle/iu);
    expect(rejection.message).toMatch(/removed/iu);
    expect(skillTransport.calls).toEqual([]);
  });

  it('passes citty unknown skill flags through to the install handler rejection', async () => {
    const { installCommand } = await import('@/commands/install.js');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation((..._args: unknown[]) => {});
    const originalExitCode = process.exitCode;
    process.exitCode = undefined;
    try {
      await runCommand(installCommand, { rawArgs: ['opencode', '--skills', 'none'] });
      expect(process.exitCode).toBe(1);
      expect(console.error).toHaveBeenCalledWith(expect.stringMatching(/bundle/iu));
    } finally {
      process.exitCode = originalExitCode;
      vi.restoreAllMocks();
    }
  });

  it('doctor reports legacy recorded copies and unmanaged duplicates without changing anything', async () => {
    const { writeSkillsRecord } = await import('@/lib/skills.js');
    await writeSkillsRecord({
      platforms: { opencode: { skills: [COMPANION_SKILL] } },
      version: 2,
    });
    const { handleDoctor } = await import('@/commands/doctor.js');
    const inventory = {
      cursor: [{ name: DOCS_UPDATE_SKILL, path: '/fake/cursor/docs-update' }],
      opencode: [{ name: COMPANION_SKILL, path: '/fake/opencode/create-pull-request' }],
    };
    const { fakeListCli } = await import('./skill-test-support.js');
    const seen: string[][] = [];
    const spying: SkillCommandRunner = async (args, options) => {
      seen.push([...args]);
      return await fakeListCli(inventory)(args, options);
    };
    const result = await handleDoctor(
      { json: true, quiet: true },
      {
        detect: async () => [
          {
            available: true,
            id: 'opencode',
            installed: true,
            installedVersion: '0.1.0',
            label: 'OpenCode',
            latestVersion: '0.1.0',
          },
          {
            available: true,
            id: 'cursor',
            installed: true,
            installedVersion: '0.1.0',
            label: 'Cursor',
            latestVersion: '0.1.0',
          },
        ],
        runner: spying,
      },
    );
    expect(result.exitCode).toBe(0);
    expect(result.output).toMatch(/Legacy CLI-installed copy/u);
    expect(result.output).toMatch(/bundles create-pull-request/u);
    expect(result.output).toMatch(/maestria update opencode/u);
    expect(result.output).toMatch(/npx -y skills@1\.7\.0 remove docs-update -a cursor -g -y/u);
    expect(seen.every((args) => args[0] === 'list')).toBe(true);
    const record = await readSkillsRecord();
    expect(record?.platforms.opencode?.skills).toEqual([COMPANION_SKILL]);
  });
});
