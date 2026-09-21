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
import { buildRecord } from './skill-test-support.js';

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

const listJson = (entries: { name: string; path: string }[]): string =>
  JSON.stringify(entries.map((entry) => ({ ...entry, scope: 'global' })));

/** Fake transport: static per-agent inventory, read-only like the real list path. */
const fakeLists =
  (inventory: Record<string, { name: string; path: string }[]>): SkillCommandRunner =>
  // oxlint-disable-next-line require-await -- synchronous fake runner by design.
  async (args: readonly string[]) => {
    if (args[0] !== 'list') {
      throw new Error(`doctor fake only lists, got: ${args[0]}`);
    }
    const flag = args.indexOf('-a');
    const agent = flag === -1 ? '' : (args[flag + 1] ?? '');
    return { stderr: '', stdout: listJson(inventory[agent] ?? []) };
  };

// oxlint-disable-next-line require-await -- synchronous fake runner by design.
const failing: SkillCommandRunner = async () => {
  throw new Error('boom');
};

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
        opencode: { path: HEALTHY_PATH, skills: [COMPANION_SKILL], source: SOURCE },
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
        opencode: { path: SHARED_PATH, skills: [COMPANION_SKILL], source: SOURCE },
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
      const result = await runJson(fakeLists(inventory), statuses, record);
      expect(parsed(result)).toMatchObject({ platforms: expectedPlatforms, recordPresent });
      for (const pattern of expectedOutput) {
        expect(result.output).toMatch(pattern);
      }
    },
  );

  it('degrades honestly for unknown platforms with no skills-CLI target', async () => {
    const runner = fakeLists({});
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
    const result = await runJson(failing, [status('opencode', { label: 'OpenCode' })], null);
    expect(parsed(result)).toMatchObject({
      platforms: [{ id: 'opencode', listError: 'boom' }],
    });
    expect(result.output).toMatch(/inventory check failed/u);
  });

  it('fails loud on a corrupt record before any observation', async () => {
    await withConfigRecord('{not-json');
    const runner = fakeLists({});
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

  it('redacts the home directory from observed paths', async () => {
    const { homedir } = await import('node:os');
    const home = homedir();
    const reports = await collectDoctorReports(
      fakeLists({
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
});
