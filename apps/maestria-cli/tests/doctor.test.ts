import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { handleDoctor } from '@/commands/doctor.js';
import { collectDoctorReports } from '@/lib/doctor.js';
import { isRecord } from '@/lib/primitives.js';
import { CliError } from '@/lib/command-result.js';
import type { CommandResult } from '@/lib/command-result.js';
import { COMPANION_SKILL, DOCS_UPDATE_SKILL } from '@/lib/skill-companion.js';
import type { SkillCommandRunner } from '@/lib/skill-companion.js';
import type { SkillsRecord } from '@/lib/skills.js';
import type { PlatformStatus } from '@/types.js';
import { buildRecord, failingSkillCli, fakeListCli } from './skill-test-support.js';

const HEALTHY_PATH = '/fake/.agents/skills/create-pull-request';

const status = (id: string, overrides: Partial<PlatformStatus> = {}): PlatformStatus => ({
  available: true,
  id,
  installed: true,
  installedVersion: '0.1.0',
  label: id,
  latestVersion: '0.1.0',
  ...overrides,
});

const configDirs: string[] = [];

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(
    configDirs.splice(0).map(async (dir) => {
      await rm(dir, { force: true, recursive: true });
    }),
  );
});

const withConfigRecord = async (text: string | null): Promise<void> => {
  const dir = await mkdtemp(path.join(tmpdir(), 'maestria-doctor-'));
  configDirs.push(dir);
  vi.stubEnv('MAESTRIA_CONFIG_DIR', dir);
  if (text !== null) {
    await writeFile(path.join(dir, 'skills.json'), text, 'utf-8');
  }
};

const runJson = async (
  runner: SkillCommandRunner,
  statuses: PlatformStatus[],
  record: SkillsRecord | null,
): Promise<CommandResult> => {
  await withConfigRecord(record === null ? null : JSON.stringify(record));
  const result = await handleDoctor(
    { json: true, quiet: true },
    // oxlint-disable-next-line require-await -- injected detect is synchronous by design.
    { detect: async () => statuses, runner },
  );
  expect(result.exitCode).toBe(0);
  return result;
};

const parsed = (result: CommandResult): unknown => {
  const value: unknown = JSON.parse(result.output);
  return value;
};

const runHuman = async (
  runner: SkillCommandRunner,
  statuses: PlatformStatus[],
  record: SkillsRecord | null,
): Promise<CommandResult> => {
  await withConfigRecord(record === null ? null : JSON.stringify(record));
  const result = await handleDoctor(
    { quiet: true },
    // oxlint-disable-next-line require-await -- injected detect is synchronous by design.
    { detect: async () => statuses, runner },
  );
  expect(result.exitCode).toBe(0);
  return result;
};

const managedFor = (dir: string): { name: string; path: string }[] => [
  { name: COMPANION_SKILL, path: `${dir}/${COMPANION_SKILL}` },
  { name: DOCS_UPDATE_SKILL, path: `${dir}/${DOCS_UPDATE_SKILL}` },
];

const countOf = (text: string, needle: string): number => text.split(needle).length - 1;

interface DoctorTableCase {
  readonly expectedOutput: readonly RegExp[];
  readonly expectedPlatforms: unknown;
  readonly inventory: Record<string, { name: string; path: string }[]>;
  readonly name: string;
  readonly record: SkillsRecord | null;
  readonly recordPresent: boolean;
  readonly statuses: PlatformStatus[];
}

describe('doctor reports', () => {
  const cases: DoctorTableCase[] = [
    {
      expectedOutput: [
        /Legacy CLI-installed copy/u,
        /bundles create-pull-request/u,
        /maestria update opencode/u,
      ],
      expectedPlatforms: [
        {
          id: 'opencode',
          missing: [],
          observed: [{ name: COMPANION_SKILL, path: HEALTHY_PATH }],
          recorded: [COMPANION_SKILL],
          unmanaged: [],
        },
      ],
      inventory: { opencode: [{ name: COMPANION_SKILL, path: HEALTHY_PATH }] },
      name: 'recorded legacy copies with a removal step',
      record: buildRecord({
        opencode: {
          skillAssets: { [COMPANION_SKILL]: { path: HEALTHY_PATH, source: 'test-source' } },
          skills: [COMPANION_SKILL],
        },
      }),
      recordPresent: true,
      statuses: [status('opencode', { label: 'OpenCode' })],
    },
    {
      expectedOutput: [
        /duplicates the bundled skill/u,
        /npx -y skills@1\.7\.0 remove create-pull-request -a cursor -g -y/u,
        /only if it came from maestria/u,
      ],
      expectedPlatforms: [{ id: 'cursor', unmanaged: [COMPANION_SKILL] }],
      inventory: {
        cursor: [{ name: COMPANION_SKILL, path: '/fake/cursor/skills/create-pull-request' }],
      },
      name: 'unmanaged duplicates with a manual removal command',
      record: null,
      recordPresent: false,
      statuses: [status('cursor', { label: 'Cursor' })],
    },
    {
      expectedOutput: [/cleaned on next update/u, /maestria update opencode/u],
      expectedPlatforms: [{ id: 'opencode', missing: [COMPANION_SKILL, DOCS_UPDATE_SKILL] }],
      inventory: { opencode: [] },
      name: 'recorded copies missing from observation with a record cleanup step',
      record: buildRecord({ opencode: [COMPANION_SKILL, DOCS_UPDATE_SKILL] }),
      recordPresent: true,
      statuses: [status('opencode', { label: 'OpenCode' })],
    },
    {
      expectedOutput: [/bundled with the maestria package; nothing to clean up/u],
      expectedPlatforms: [{ id: 'opencode', missing: [], next: [], unmanaged: [] }],
      inventory: { opencode: [] },
      name: 'clean platforms with bundled skills and no next step',
      record: null,
      recordPresent: false,
      statuses: [status('opencode', { label: 'OpenCode' })],
    },
    {
      expectedOutput: [/bundled with the maestria package; nothing to clean up/u],
      expectedPlatforms: [{ id: 'opencode', missing: [], next: [], unmanaged: [] }],
      inventory: { opencode: [{ name: 'my-own-skill', path: '/fake/opencode/my-own-skill' }] },
      name: 'clean platforms whose agent only has unrelated skills',
      record: null,
      recordPresent: false,
      statuses: [status('opencode', { label: 'OpenCode' })],
    },
  ];
  it.each(cases)(
    'reports $name',
    async ({ expectedOutput, expectedPlatforms, inventory, record, recordPresent, statuses }) => {
      const result = await runJson(fakeListCli(inventory), statuses, record);
      expect(parsed(result)).toMatchObject({ platforms: expectedPlatforms, recordPresent });
      for (const pattern of expectedOutput) {
        expect(result.output).toMatch(pattern);
      }
    },
  );

  it('notes bundled skills with nothing to check for platforms without an agent', async () => {
    const runner = fakeListCli({});
    const seen: string[][] = [];
    const spying: SkillCommandRunner = async (args, options) => {
      seen.push([...args]);
      return await runner(args, options);
    };
    const result = await runJson(spying, [], buildRecord({ mystery: [] }));
    expect(parsed(result)).toMatchObject({ platforms: [{ agent: null, id: 'mystery' }] });
    expect(seen).toEqual([]);
    expect(result.output).toMatch(/bundled with the maestria package; nothing to check/u);
  });

  it('degrades honestly when the list call fails without failing the command', async () => {
    const result = await runJson(
      failingSkillCli,
      [status('opencode', { label: 'OpenCode' })],
      null,
    );
    expect(parsed(result)).toMatchObject({
      platforms: [{ id: 'opencode', listError: 'boom' }],
    });
    expect(result.output).toMatch(/inventory check failed/u);
  });

  it('fails loud on a corrupt record before any observation', async () => {
    await withConfigRecord('{not-json');
    const runner = fakeListCli({});
    const seen: string[][] = [];
    const spying: SkillCommandRunner = async (args, options) => {
      seen.push([...args]);
      return await runner(args, options);
    };
    await expect(
      handleDoctor(
        { json: true, quiet: true },
        // oxlint-disable-next-line require-await -- injected detect is synchronous by design.
        { detect: async () => [status('opencode')], runner: spying },
      ),
    ).rejects.toThrow(CliError);
    expect(seen).toEqual([]);
  });

  it('fails loud on --compact without touching detection or skill inventory', async () => {
    await withConfigRecord(null);
    const runner = fakeListCli({});
    const seen: string[][] = [];
    const spying: SkillCommandRunner = async (args, options) => {
      seen.push([...args]);
      return await runner(args, options);
    };
    let detectCalls = 0;
    let thrown: unknown;
    try {
      await handleDoctor(
        { compact: true },
        {
          // oxlint-disable-next-line require-await -- injected detect is synchronous by design.
          detect: async () => {
            detectCalls += 1;
            return [status('opencode')];
          },
          runner: spying,
        },
      );
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(CliError);
    if (!(thrown instanceof CliError)) {
      throw new Error('Expected handleDoctor to throw CliError');
    }
    expect(thrown.exitCode).toBe(1);
    expect(thrown.message).toContain('--compact');
    expect(thrown.message).toContain('--json');
    expect(thrown.message).toContain('--quiet');
    expect(detectCalls).toBe(0);
    expect(seen).toEqual([]);

    // Unchanged behavior without the flag.
    const healthy = await runJson(fakeListCli({}), [status('opencode')], null);
    expect(healthy.exitCode).toBe(0);
  });

  it('redacts the home directory from observed paths', async () => {
    const { homedir } = await import('node:os');
    const home = homedir();
    const reports = await collectDoctorReports(
      fakeListCli({
        opencode: [{ name: COMPANION_SKILL, path: `${home}/.agents/skills/create-pull-request` }],
      }),
      [status('opencode')],
      null,
    );
    expect(reports[0]?.observed[0]?.path).toBe('~/.agents/skills/create-pull-request');
  });

  it('lists each distinct agent once across platforms sharing one target', async () => {
    const calls: string[] = [];
    // oxlint-disable-next-line require-await -- synchronous fake runner by design.
    const runner: SkillCommandRunner = async (args) => {
      const flag = args.indexOf('-a');
      calls.push(flag === -1 ? '' : (args[flag + 1] ?? ''));
      return { stderr: '', stdout: '[]' };
    };
    const record = buildRecord({ omp: [], opencode: [] });
    const reports = await collectDoctorReports(runner, [status('opencode'), status('omp')], record);
    expect(reports).toHaveLength(2);
    expect(calls.filter((agent) => agent === 'universal')).toHaveLength(1);
    expect(calls.filter((agent) => agent === 'opencode')).toHaveLength(1);
  });

  describe('large inventories', () => {
    const UNRELATED_COUNT = 180;
    const unrelatedNames = Array.from({ length: UNRELATED_COUNT }, (_, i) => `unrelated-${i}`);
    const unrelatedFor = (dir: string): { name: string; path: string }[] =>
      unrelatedNames.map((name) => ({ name, path: `${dir}/${name}` }));
    const inventory = {
      cursor: [...managedFor('/fake/cursor/skills'), ...unrelatedFor('/fake/cursor/skills')],
      opencode: [...managedFor('/fake/opencode/skills'), ...unrelatedFor('/fake/opencode/skills')],
      universal: [...managedFor('/fake/shared/skills'), ...unrelatedFor('/fake/shared/skills')],
    };
    const largeStatuses = [
      status('opencode', { label: 'OpenCode' }),
      status('omp', { label: 'Oh My Pi' }),
      status('cursor', {
        available: true,
        installed: false,
        installedVersion: '',
        label: 'Cursor',
      }),
    ];

    it('collapses unrelated skills in human output while JSON keeps the full arrays', async () => {
      const human = await runHuman(fakeListCli(inventory), largeStatuses, null);
      expect(human.output).toContain(
        `${COMPANION_SKILL} @ /fake/opencode/skills/${COMPANION_SKILL}`,
      );
      expect(human.output).toContain(
        `${DOCS_UPDATE_SKILL} @ /fake/shared/skills/${DOCS_UPDATE_SKILL}`,
      );
      expect(human.output).toContain('180 unrelated skills omitted, see --json for the full list.');
      for (const name of unrelatedNames) {
        expect(human.output).not.toContain(name);
      }

      const json = await runJson(fakeListCli(inventory), largeStatuses, null);
      expect(parsed(json)).toMatchObject({
        platforms: [
          { id: 'opencode', observed: inventory.opencode },
          { id: 'omp', observed: inventory.universal },
          { id: 'cursor', observed: inventory.cursor },
        ],
      });
    });

    it('renders exactly one Next line per platform', async () => {
      const human = await runHuman(fakeListCli(inventory), largeStatuses, null);
      expect(countOf(human.output, 'Next:')).toBe(largeStatuses.length);
      expect(human.output).toContain('to install the plugin');
      expect(human.output).toContain('only if it came from maestria');

      const json = await runJson(fakeListCli(inventory), largeStatuses, null);
      const report = parsed(json);
      if (!isRecord(report) || !Array.isArray(report.platforms)) {
        throw new Error('Doctor JSON is missing platforms');
      }
      const { platforms } = report;
      expect(platforms.map((platform) => (isRecord(platform) ? platform.id : undefined))).toEqual([
        'opencode',
        'omp',
        'cursor',
      ]);
      for (const platform of platforms) {
        if (!isRecord(platform) || !Array.isArray(platform.next)) {
          throw new Error('Doctor JSON is missing next actions');
        }
        for (const item of platform.next) {
          expect(typeof item).toBe('string');
        }
        expect(
          platform.next.some((item) => typeof item === 'string' && item.includes('npx -y')),
        ).toBe(true);
      }
    });
  });
});
