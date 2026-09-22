// oxlint-disable require-await -- test fakes match async dependency signatures synchronously by design.
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { CliError } from '@/lib/command-result.js';
import type { SkillCommandRunner } from '@/lib/skill-companion.js';
import { isRecord } from '@/lib/primitives.js';
import { parseEcosystem, parseSkillSources, runSetup } from '@/lib/setup.js';
import type { XtarterizeRunner } from '@/lib/setup.js';
import type { SkillsRecord } from '@/lib/skills.js';
import type { PlatformStatus } from '@/types.js';
import { buildRecord, fakeSkillCli } from './skill-test-support.js';

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
  vi.stubEnv('MAESTRIA_SKILLS_SOURCE', 'test-source');
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(
    configDirs.splice(0).map(async (dir) => {
      await rm(dir, { force: true, recursive: true });
    }),
  );
});

const withConfigDir = async (): Promise<string> => {
  const dir = await mkdtemp(path.join(tmpdir(), 'maestria-setup-'));
  configDirs.push(dir);
  vi.stubEnv('MAESTRIA_CONFIG_DIR', dir);
  return dir;
};

const captureCliError = async (promise: Promise<unknown>): Promise<CliError> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof CliError) {
      return error;
    }
    throw error;
  }
  throw new Error('Expected setup to throw CliError');
};

const xtarterizeOk =
  (calls: string[][]): XtarterizeRunner =>
  // oxlint-disable-next-line require-await -- synchronous fake runner by design.
  async (args) => {
    calls.push([...args]);
    return {
      exitCode: 0,
      stderr: '',
      stdout: JSON.stringify({ status: 'applied' }),
    };
  };

const twoPlatforms = async (): Promise<PlatformStatus[]> => [status('opencode'), status('pi')];

const absentProbe = async (): Promise<{ present: boolean; version: string }> => ({
  present: false,
  version: '',
});

const nullRecord = async (): Promise<SkillsRecord | null> => null;

const emptyRecord = async (): Promise<SkillsRecord> => buildRecord({ opencode: [], pi: [] });

const opencodeEmptyRecord = async (): Promise<SkillsRecord> => buildRecord({ opencode: [] });

const nullGitignore = async (): Promise<string | null> => null;

const staticXtarterizePath = async (): Promise<string | null> => '/usr/bin/xtarterize';

const missingXtarterizePath = async (): Promise<string | null> => null;

const xtarterizeNotApplicable: XtarterizeRunner = async () => ({
  exitCode: 0,
  stderr: '',
  stdout: JSON.stringify({ status: 'not-applicable' }),
});

const xtarterizeMissingStatus: XtarterizeRunner = async () => ({
  exitCode: 0,
  stderr: '',
  stdout: 'banner only',
});

const failingSkillCli: SkillCommandRunner = async () => {
  throw new Error('skills offline');
};

const baseDeps = (
  overrides: Partial<Parameters<typeof runSetup>[1]> = {},
): Parameters<typeof runSetup>[1] => ({
  detect: twoPlatforms,
  ecosystemProbe: absentProbe,
  isInteractive: () => false,
  readGitignore: nullGitignore,
  readRecord: nullRecord,
  skillRunner: fakeSkillCli({}),
  xtarterize: xtarterizeOk([]),
  xtarterizePath: staticXtarterizePath,
  ...overrides,
});

interface SetupActionShape {
  readonly category: string;
  readonly item: string;
  readonly status: string;
}

const isSetupAction = (value: unknown): value is SetupActionShape =>
  isRecord(value) &&
  typeof value.category === 'string' &&
  typeof value.item === 'string' &&
  typeof value.status === 'string';

const actionsOf = (output: string): SetupActionShape[] => {
  const parsed: unknown = JSON.parse(output);
  if (!isRecord(parsed) || !Array.isArray(parsed.actions)) {
    throw new Error('setup JSON output is missing the actions array');
  }
  return parsed.actions.filter(isSetupAction);
};

describe('setup arg parity', () => {
  it('maps --ecosystem CSV to detection reports without installing', async () => {
    await withConfigDir();
    const probes: string[] = [];
    const result = await runSetup(
      { ecosystem: 'codegraph,opensrc', json: true, quiet: true, yes: true },
      baseDeps({
        ecosystemProbe: async (tool) => {
          probes.push(tool);
          return tool === 'codegraph'
            ? { present: true, version: 'codegraph 1.2.3' }
            : { present: false, version: '' };
        },
      }),
    );
    expect(result.exitCode).toBe(0);
    const eco = actionsOf(result.output).filter((a) => a.category === 'ecosystem');
    expect(eco.map((a) => a.item).toSorted()).toEqual(['codegraph', 'opensrc']);
    expect(eco.find((a) => a.item === 'codegraph')?.status).toBe('ok');
    expect(eco.find((a) => a.item === 'opensrc')?.status).toBe('skipped');
    expect(probes).toContain('codegraph');
  });

  it('accepts repeatable or CSV --skill-source with project/global scope', async () => {
    await withConfigDir();
    const seen: string[][] = [];
    const inner = fakeSkillCli({});
    const runner: SkillCommandRunner = async (args, options) => {
      seen.push([...args]);
      return await inner(args, options);
    };
    const csv = await runSetup(
      { json: true, quiet: true, skillSource: 'acme/a:global,acme/b:project', yes: true },
      baseDeps({ readRecord: emptyRecord, skillRunner: runner }),
    );
    expect(csv.exitCode).toBe(0);
    const arrayed = await runSetup(
      { json: true, quiet: true, skillSource: ['acme/a:global', 'acme/b:project'], yes: true },
      baseDeps({ readRecord: emptyRecord, skillRunner: runner }),
    );
    expect(arrayed.exitCode).toBe(0);
    expect(seen.some((a) => a.includes('-g'))).toBe(true);
    expect(seen.some((a) => !a.includes('-g'))).toBe(true);
    expect(parseSkillSources('acme/a:global')).toEqual([{ scope: 'global', source: 'acme/a' }]);
    expect(parseEcosystem('codegraph')).toEqual(['codegraph']);
  });

  it('treats --maestria-skills as an alias for --skills', async () => {
    await withConfigDir();
    const direct = await runSetup(
      { json: true, quiet: true, skills: 'create-pull-request', yes: true },
      baseDeps({ readRecord: opencodeEmptyRecord }),
    );
    const aliased = await runSetup(
      { json: true, maestriaSkills: 'create-pull-request', quiet: true, yes: true },
      baseDeps({ readRecord: opencodeEmptyRecord }),
    );
    expect(direct.exitCode).toBe(0);
    expect(aliased.exitCode).toBe(0);
    const maestriaOnly = (output: string): SetupActionShape[] =>
      actionsOf(output).filter((a) => a.category === 'maestria-skills');
    expect(maestriaOnly(direct.output)).toEqual(maestriaOnly(aliased.output));
  });

  it('invokes the exact xtarterize task command with --cwd, never bare add', async () => {
    await withConfigDir();
    const calls: string[][] = [];
    const cwd = await mkdtemp(path.join(tmpdir(), 'maestria-setup-cwd-'));
    configDirs.push(cwd);
    const result = await runSetup(
      { cwd, json: true, quiet: true, xtarterizeSkills: true, yes: true },
      baseDeps({
        readRecord: opencodeEmptyRecord,
        xtarterize: xtarterizeOk(calls),
      }),
    );
    expect(result.exitCode).toBe(0);
    expect(calls[1] ?? []).toEqual(['add', 'agent/skills-install', '--json', '--cwd', cwd]);
    expect(calls.some((c) => c[0] === 'add' && c[1] === undefined)).toBe(false);
    expect(calls.some((c) => c.includes('--all'))).toBe(false);
  });
});

describe('setup pre-effect validation', () => {
  it('rejects unknown ecosystem tools before any effect', async () => {
    await withConfigDir();
    const calls: string[][] = [];
    await expect(
      runSetup(
        { ecosystem: 'nope', json: true, quiet: true, yes: true },
        baseDeps({ xtarterize: xtarterizeOk(calls) }),
      ),
    ).rejects.toThrow(/Unknown ecosystem tool/u);
    expect(calls.length).toBe(0);
  });

  it('rejects malformed skill sources before any effect', async () => {
    await withConfigDir();
    const calls: string[][] = [];
    await expect(
      runSetup(
        { json: true, quiet: true, skillSource: 'acme-missing-scope', yes: true },
        baseDeps({ xtarterize: xtarterizeOk(calls) }),
      ),
    ).rejects.toThrow(/Invalid --skill-source/u);
    expect(calls.length).toBe(0);
  });

  it('rejects unknown Maestria skills before any effect', async () => {
    await withConfigDir();
    const calls: string[][] = [];
    await expect(
      runSetup(
        { json: true, quiet: true, skills: 'nope', yes: true },
        baseDeps({ xtarterize: xtarterizeOk(calls) }),
      ),
    ).rejects.toThrow(/Unknown skill/u);
    expect(calls.length).toBe(0);
  });

  it('fails loud when xtarterize is absent from PATH', async () => {
    await withConfigDir();
    const result = await runSetup(
      { json: true, quiet: true, xtarterizeSkills: true, yes: true },
      baseDeps({
        readRecord: opencodeEmptyRecord,
        xtarterizePath: missingXtarterizePath,
      }),
    );
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('not found on PATH');
  });

  it('blocks unmanaged skills via ownership preflight without mutating', async () => {
    await withConfigDir();
    const calls: string[][] = [];
    const runner = fakeSkillCli({
      'opencode:create-pull-request': '/other/skills/create-pull-request',
    });
    await runner([
      'add',
      'test-source',
      '-a',
      'opencode',
      '-s',
      'create-pull-request',
      '-g',
      '--json',
      '-y',
    ]);
    await expect(
      runSetup(
        { json: true, quiet: true, skills: 'create-pull-request', yes: true },
        baseDeps({
          readRecord: nullRecord,
          skillRunner: runner,
          xtarterize: xtarterizeOk(calls),
        }),
      ),
    ).rejects.toThrow(/Existing unmanaged skill/u);
    expect(calls.length).toBe(0);
  });
});

describe('setup reporting and reruns', () => {
  it('gates xtarterize on JSON status, not exit code', async () => {
    await withConfigDir();
    const skipped = await runSetup(
      { json: true, quiet: true, xtarterizeSkills: true, yes: true },
      baseDeps({
        readRecord: opencodeEmptyRecord,
        xtarterize: xtarterizeNotApplicable,
      }),
    );
    expect(skipped.exitCode).toBe(0);
    expect(skipped.output).toContain('not-applicable');

    const failed = await runSetup(
      { json: true, quiet: true, xtarterizeSkills: true, yes: true },
      baseDeps({
        readRecord: opencodeEmptyRecord,
        xtarterize: xtarterizeMissingStatus,
      }),
    );
    expect(failed.exitCode).toBe(1);
    expect(failed.output).toContain('No JSON status field');
  });

  it('reports partial failure without claiming success', async () => {
    await withConfigDir();
    const calls: string[][] = [];
    const result = await runSetup(
      {
        json: true,
        quiet: true,
        skillSource: 'acme/a:global',
        xtarterizeSkills: true,
        yes: true,
      },
      baseDeps({
        readRecord: emptyRecord,
        skillRunner: failingSkillCli,
        xtarterize: xtarterizeOk(calls),
      }),
    );
    expect(result.exitCode).toBe(1);
    const actions = actionsOf(result.output);
    expect(actions.some((a) => a.status === 'failed')).toBe(true);
    expect(actions.some((a) => a.category === 'xtarterize' && a.status === 'ok')).toBe(true);
  });

  it('reruns idempotently with the same args', async () => {
    await withConfigDir();
    const calls: string[][] = [];
    const args = {
      ecosystem: 'codegraph',
      json: true,
      quiet: true,
      skillSource: 'acme/a:global',
      xtarterizeSkills: true,
      yes: true,
    };
    const first = await runSetup(
      args,
      baseDeps({ readRecord: emptyRecord, xtarterize: xtarterizeOk(calls) }),
    );
    const second = await runSetup(
      args,
      baseDeps({ readRecord: emptyRecord, xtarterize: xtarterizeOk(calls) }),
    );
    expect(first.exitCode).toBe(0);
    expect(second.exitCode).toBe(0);
    expect(actionsOf(second.output).length).toBeGreaterThan(0);
  });

  it('emits valid JSON with resume guidance', async () => {
    await withConfigDir();
    const result = await runSetup(
      { ecosystem: 'opensrc', json: true, quiet: true, yes: true },
      baseDeps({ readRecord: emptyRecord }),
    );
    expect(result.exitCode).toBe(0);
    const parsed: unknown = JSON.parse(result.output);
    if (!isRecord(parsed) || typeof parsed.resume !== 'string') {
      throw new Error('setup JSON output is missing resume guidance');
    }
    expect(actionsOf(result.output).length).toBeGreaterThan(0);
    expect(parsed.resume).toContain('Re-run with the same args');
  });

  it('notes manual goal tracking when OpenCode is detected, never installing', async () => {
    await withConfigDir();
    const text = await runSetup({ quiet: true, yes: true }, baseDeps({ readRecord: emptyRecord }));
    expect(text.exitCode).toBe(0);
    expect(text.output).toContain('goal tracking stays manual');
    expect(text.output).not.toContain('@maestria/opencode');
  });
});

describe('setup non-TTY refusal', () => {
  it('names missing flags when nothing was provided', async () => {
    await withConfigDir();
    const error = await captureCliError(runSetup({ quiet: true }, baseDeps()));
    expect(error.exitCode).toBe(1);
    expect(error.message).toContain('--ecosystem');
    expect(error.message).toContain('--yes');
  });

  it('requires --yes for mutating selections', async () => {
    await withConfigDir();
    const error = await captureCliError(
      runSetup({ ecosystem: 'codegraph', quiet: true }, baseDeps()),
    );
    expect(error.message).toContain('--yes');
  });
});

describe('setup live detection only', () => {
  it('probes a missing binary as absent without installing', async () => {
    await withConfigDir();
    const result = await runSetup(
      { ecosystem: 'codegraph', json: true, quiet: true, yes: true },
      baseDeps({
        detect: async () => [],
        ecosystemProbe: absentProbe,
        readRecord: nullRecord,
      }),
    );
    expect(result.exitCode).toBe(0);
    expect(actionsOf(result.output).length).toBeGreaterThan(0);
  });
});
