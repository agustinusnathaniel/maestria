import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { handleDoctor } from '@/commands/doctor.js';
import { collectDoctorReports } from '@/lib/doctor.js';
import { CliError } from '@/lib/command-result.js';
import type { CommandResult } from '@/lib/command-result.js';
import { COMPANION_SKILL, DOCS_UPDATE_SKILL } from '@/lib/skill-companion.js';
import type { SkillCommandRunner } from '@/lib/skill-companion.js';
import type { SkillsRecord } from '@/lib/skills.js';
import type { PlatformStatus } from '@/types.js';
import { buildRecord, failingSkillCli, fakeListCli } from './skill-test-support.js';

const SOURCE = 'test-source';
const HEALTHY_PATH = '/fake/.agents/skills/create-pull-request';
const SHARED_PATH = '/fake/.agents/skills/create-pull-request';

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

beforeEach(() => {
  vi.stubEnv('MAESTRIA_SKILLS_SOURCE', SOURCE);
});

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
      expectedOutput: [],
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
      name: 'healthy platform with recorded skills fully observed',
      record: buildRecord({
        opencode: {
          skillAssets: { [COMPANION_SKILL]: { path: HEALTHY_PATH, source: SOURCE } },
          skills: [COMPANION_SKILL],
        },
      }),
      recordPresent: true,
      statuses: [status('opencode', { label: 'OpenCode' })],
    },
    {
      expectedOutput: [/unmanaged/u, /--exclude-skills create-pull-request/u],
      expectedPlatforms: [{ id: 'cursor', unmanaged: [COMPANION_SKILL] }],
      inventory: {
        cursor: [{ name: COMPANION_SKILL, path: '/fake/cursor/skills/create-pull-request' }],
      },
      name: 'unmanaged copies with an exclude-or-remove next step',
      record: null,
      recordPresent: false,
      statuses: [status('cursor', { label: 'Cursor' })],
    },
    {
      expectedOutput: [/share the recorded copy/u],
      expectedPlatforms: [
        { id: 'opencode' },
        {
          id: 'omp',
          shared: [{ path: SHARED_PATH, providers: ['opencode'], skill: COMPANION_SKILL }],
          unmanaged: [COMPANION_SKILL],
        },
      ],
      inventory: { universal: [{ name: COMPANION_SKILL, path: SHARED_PATH }] },
      name: 'shared canonical paths instead of warning when another platform provides the copy',
      record: buildRecord({
        omp: [],
        opencode: {
          skillAssets: { [COMPANION_SKILL]: { path: SHARED_PATH, source: SOURCE } },
          skills: [COMPANION_SKILL],
        },
      }),
      recordPresent: true,
      statuses: [status('opencode', { label: 'OpenCode' }), status('omp', { label: 'Oh My Pi' })],
    },
    {
      expectedOutput: [/maestria update opencode/u],
      expectedPlatforms: [{ id: 'opencode', missing: [COMPANION_SKILL, DOCS_UPDATE_SKILL] }],
      inventory: { opencode: [] },
      name: 'recorded skills missing from observation with a restore step',
      record: buildRecord({ opencode: [COMPANION_SKILL, DOCS_UPDATE_SKILL] }),
      recordPresent: true,
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

  it('degrades honestly for unknown platforms with no skills-CLI target', async () => {
    const runner = fakeListCli({});
    const seen: string[][] = [];
    const spying: SkillCommandRunner = async (args, options) => {
      seen.push([...args]);
      return await runner(args, options);
    };
    const result = await runJson(spying, [], buildRecord({ mystery: [] }));
    expect(parsed(result)).toMatchObject({ platforms: [{ agent: null, id: 'mystery' }] });
    expect(seen).toEqual([]);
    expect(result.output).toMatch(/No skills-CLI target/u);
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

  it('lists only the true sharer when two other platforms do not share', async () => {
    const record = buildRecord({
      'claude-code': {
        skillAssets: {
          [COMPANION_SKILL]: { path: '/fake/other/skills/create-pull-request', source: SOURCE },
        },
        skills: [COMPANION_SKILL],
      },
      codex: {
        skillAssets: { [COMPANION_SKILL]: { path: SHARED_PATH, source: 'other-source' } },
        skills: [COMPANION_SKILL],
      },
      cursor: [],
      opencode: {
        skillAssets: { [COMPANION_SKILL]: { path: SHARED_PATH, source: SOURCE } },
        skills: [COMPANION_SKILL],
      },
    });
    const reports = await collectDoctorReports(
      fakeListCli({
        'claude-code': [],
        codex: [],
        cursor: [{ name: COMPANION_SKILL, path: SHARED_PATH }],
        opencode: [],
      }),
      [status('cursor'), status('opencode'), status('codex'), status('claude-code')],
      record,
      SOURCE,
    );
    const cursorReport = reports.find((report) => report.id === 'cursor');
    expect(cursorReport?.unmanaged).toEqual([COMPANION_SKILL]);
    expect(cursorReport?.shared).toEqual([
      { path: SHARED_PATH, providers: ['opencode'], skill: COMPANION_SKILL },
    ]);
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
      SOURCE,
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
    const record = buildRecord({ omp: [], opencode: [], 'prime-agent': [] });
    const reports = await collectDoctorReports(
      runner,
      [status('opencode'), status('omp'), status('prime-agent')],
      record,
      SOURCE,
    );
    expect(reports).toHaveLength(3);
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
      status('prime-agent', { label: 'Prime Agent' }),
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
          { id: 'prime-agent', observed: inventory.universal },
          { id: 'cursor', observed: inventory.cursor },
        ],
      });
    });

    it('renders a shared inventory once and exactly one Next line per platform', async () => {
      const human = await runHuman(fakeListCli(inventory), largeStatuses, null);
      const observedLines = human.output.split('\n').filter((line) => line.includes('Observed:'));
      expect(observedLines.filter((line) => line.includes('/fake/shared/skills'))).toHaveLength(1);
      expect(human.output).toContain('same as omp');
      expect(countOf(human.output, 'unrelated skills omitted')).toBe(3);
      expect(countOf(human.output, 'Next:')).toBe(largeStatuses.length);
      expect(human.output).toContain('to install the plugin');
      expect(human.output).toContain('to record a selection');
      expect(human.output).not.toContain('--exclude-skills');

      const json = await runJson(fakeListCli(inventory), largeStatuses, null);
      expect(parsed(json)).toMatchObject({
        platforms: [
          {
            id: 'opencode',
            next: [
              expect.stringContaining('--exclude-skills'),
              expect.stringContaining('--exclude-skills'),
              expect.stringContaining('to record a selection'),
            ],
          },
          {
            id: 'omp',
            next: [
              expect.stringContaining('--exclude-skills'),
              expect.stringContaining('--exclude-skills'),
              expect.stringContaining('to record a selection'),
            ],
          },
          {
            id: 'prime-agent',
            next: [
              expect.stringContaining('--exclude-skills'),
              expect.stringContaining('--exclude-skills'),
              expect.stringContaining('to record a selection'),
            ],
          },
          {
            id: 'cursor',
            next: [
              expect.stringContaining('--exclude-skills'),
              expect.stringContaining('--exclude-skills'),
              expect.stringContaining('to record a selection'),
              expect.stringContaining('to install the plugin'),
            ],
          },
        ],
      });
    });
  });
});
