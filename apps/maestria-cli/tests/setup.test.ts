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
import { isNoopSetupPlan } from '@/lib/setup-plan.js';
import { xtarterizeStatusOf } from '@/lib/setup-actions.js';
import type { SetupSelection } from '@/lib/setup-plan.js';
import type { SkillsRecord } from '@/lib/skills.js';
import type { PlatformStatus } from '@/types.js';
import { buildRecord, fakeSkillCli } from './skill-test-support.js';
import { createTtyTestSupport } from './tty-test-support.js';

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

const groupMocks = vi.hoisted(() => ({
  groupMultiselect: vi.fn(),
}));
const promptMocks = vi.hoisted(() => ({
  cancel: vi.fn(),
  // oxlint-disable-next-line require-await -- synchronous confirm stub by design.
  confirm: vi.fn(async () => true),
  isCancel: vi.fn(() => false),
  spinner: vi.fn(() => ({ message: vi.fn(), start: vi.fn(), stop: vi.fn() })),
}));

vi.mock('@/lib/group-multiselect.js', () => ({
  groupMultiselect: groupMocks.groupMultiselect,
}));

vi.mock('@clack/prompts', () => ({
  cancel: promptMocks.cancel,
  confirm: promptMocks.confirm,
  isCancel: promptMocks.isCancel,
  spinner: promptMocks.spinner,
}));

const { restoreTty, setTty } = createTtyTestSupport();

beforeEach(() => {
  vi.stubEnv('MAESTRIA_SKILLS_SOURCE', 'test-source');
});

afterEach(async () => {
  vi.unstubAllEnvs();
  restoreTty();
  groupMocks.groupMultiselect.mockReset();
  promptMocks.confirm.mockClear();
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
  it.each([
    ['{"status":"applied"}', 'applied'],
    ['{"status":"failed","result":{"status":"applied"}}', 'failed'],
    ['banner\n{"result":{"status":"applied"}}\ndone', 'applied'],
    ['{"data":{"status":"skipped"}}', 'skipped'],
    ['{"summary":{"status":"ok"}}', 'ok'],
    ['{"status":"applied","details":{"path":"{target}"}}', 'applied'],
    ['{"status":"applied"}\n{"status":"failed"}', 'failed'],
    ['{"status":"applied"}\n{"details":{}}', null],
    ['{"status":false}', null],
    ['banner only', null],
    ['{"status":', null],
  ])('reads the final complete xtarterize status: %s', (stdout, expected) => {
    expect(xtarterizeStatusOf(stdout)).toBe(expected);
  });

  it('verifies project skill sources in the requested cwd', async () => {
    const cwd = await withConfigDir();
    const calls: { args: readonly string[]; cwd?: string }[] = [];
    const inner = fakeSkillCli({});
    const runner: SkillCommandRunner = async (args, options) => {
      calls.push({ args, cwd: options?.cwd });
      return await inner(args, options);
    };
    await runSetup(
      { cwd, json: true, quiet: true, skillSource: 'acme/a:project', yes: true },
      baseDeps({ readRecord: emptyRecord, skillRunner: runner }),
    );
    const projectCalls = calls.filter(({ args }) => !args.includes('-g'));
    expect(projectCalls.length).toBeGreaterThan(0);
    expect(projectCalls.some(({ args }) => args[0] === 'list')).toBe(true);
    expect(projectCalls.every((call) => call.cwd === cwd)).toBe(true);
    expect(
      calls.filter(({ args }) => args.includes('-g')).every((call) => call.cwd === undefined),
    ).toBe(true);
  });

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

const noopPlan = (overrides: Partial<SetupSelection> = {}): SetupSelection => ({
  ecosystem: [],
  maestriaActive: false,
  maestriaSkills: undefined,
  reviewed: [],
  sources: [],
  xtarterize: false,
  ...overrides,
});

describe('setup scope clarity', () => {
  interface PickerCall {
    initialValues?: string[];
    message: string;
    options?: Record<string, unknown>;
  }

  it('shows global scope in the skill review prompt', async () => {
    await withConfigDir();
    setTty(true);
    const messages: string[] = [];
    groupMocks.groupMultiselect.mockImplementation(async (opts: PickerCall) => {
      messages.push(opts.message);
      if (opts.message.includes('Which setup items')) {
        return [];
      }
      return [...(opts.initialValues ?? [])];
    });
    const result = await runSetup(
      { quiet: true },
      baseDeps({ isInteractive: () => true, readRecord: emptyRecord }),
    );
    expect(result.exitCode).toBe(0);
    expect(
      messages.some(
        (message) => message.includes('methodology skills') && message.includes('global scope'),
      ),
    ).toBe(true);
  });

  it('names global scope, target directory role, and full cancel semantics in setup confirms', async () => {
    await withConfigDir();
    setTty(true);
    groupMocks.groupMultiselect.mockImplementation(async (opts: PickerCall) => {
      if (opts.message.includes('Which setup items')) {
        return [];
      }
      return [];
    });
    const result = await runSetup(
      { quiet: true },
      baseDeps({ isInteractive: () => true, readRecord: nullRecord }),
    );
    expect(result.exitCode).toBe(0);
    const confirmMessages = (promptMocks.confirm.mock.calls as unknown[][]).map((call) => {
      const arg: unknown = call[0];
      return isRecord(arg) && typeof arg.message === 'string' ? arg.message : '';
    });
    const perGroup = confirmMessages.find((message) => message.startsWith('Install with skills'));
    expect(perGroup).toBeDefined();
    expect(perGroup ?? '').toContain('(global)');
    const finalConfirm = confirmMessages.at(-1) ?? '';
    expect(finalConfirm).toContain('opencode (global)=[');
    expect(finalConfirm).toContain(
      'Project-scoped actions use the target directory; global actions do not depend on it.',
    );
    expect(finalConfirm).toContain('Answering No cancels the entire setup with nothing changed.');
  });

  it('shows global scope in the maestria skills summary output', async () => {
    await withConfigDir();
    const result = await runSetup({ quiet: true, yes: true }, baseDeps({ readRecord: nullRecord }));
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('(global scope)');
  });
});

describe('isNoopSetupPlan', () => {
  const probes = new Map([
    ['codegraph', { present: true, version: 'codegraph 1.2.3' }],
    ['opensrc', { present: false, version: '' }],
  ]);

  it.each([
    {
      expected: true,
      name: 'nothing selected and nothing changed',
      plan: noopPlan(),
    },
    {
      expected: true,
      name: 'selected ecosystem tools already detected',
      plan: noopPlan({ ecosystem: ['codegraph'] }),
    },
    {
      expected: false,
      name: 'selected ecosystem tool not detected',
      plan: noopPlan({ ecosystem: ['opensrc'] }),
    },
    {
      expected: false,
      name: 'xtarterize selected because conformance needs its mutating check',
      plan: noopPlan({ xtarterize: true }),
    },
    {
      expected: false,
      name: 'skill sources selected',
      plan: noopPlan({ sources: [{ scope: 'global', source: 'acme/a' }] }),
    },
    {
      expected: false,
      name: 'Maestria defaults kept on a fresh install',
      plan: noopPlan({
        maestriaActive: true,
        reviewed: [
          { id: 'opencode', selection: { changed: false, skills: ['create-pull-request'] } },
        ],
      }),
    },
    {
      expected: false,
      name: 'any Maestria selection changed',
      plan: noopPlan({
        reviewed: [
          { id: 'opencode', selection: { changed: false, skills: [] } },
          { id: 'pi', selection: { changed: true, skills: ['create-pull-request'] } },
        ],
      }),
    },
  ])('$name', ({ expected, plan }) => {
    expect(isNoopSetupPlan(plan, probes)).toBe(expected);
  });
});

describe('setup no-op confirm skipping', () => {
  it('exits 0 with an already-set-up summary and zero mutations when the plan is fully no-op', async () => {
    await withConfigDir();
    const skillCalls: string[][] = [];
    const xtarterizeCalls: string[][] = [];
    const inner = fakeSkillCli({});
    const result = await runSetup(
      { ecosystem: 'codegraph', json: true, quiet: true, yes: true },
      baseDeps({
        detect: async () => [],
        ecosystemProbe: async () => ({ present: true, version: 'codegraph 9.9.9' }),
        readRecord: nullRecord,
        skillRunner: async (args, options) => {
          skillCalls.push([...args]);
          return await inner(args, options);
        },
        xtarterize: xtarterizeOk(xtarterizeCalls),
      }),
    );
    expect(result.exitCode).toBe(0);
    expect(actionsOf(result.output).length).toBe(0);
    expect(skillCalls.length).toBe(0);
    expect(xtarterizeCalls.length).toBe(0);
    const parsed: unknown = JSON.parse(result.output);
    expect(parsed).toMatchObject({
      actions: [],
      detection: { recordPresent: false, xtarterizeOnPath: '/usr/bin/xtarterize' },
    });
    if (!isRecord(parsed) || typeof parsed.resume !== 'string') {
      throw new Error('setup JSON output is missing resume guidance');
    }
    expect(parsed.resume).toContain('Re-run with the same args');
  });

  it('requires --yes for a will-run xtarterize plan even when everything else is settled', async () => {
    await withConfigDir();
    const error = await captureCliError(
      runSetup(
        { ecosystem: 'codegraph', quiet: true, xtarterizeSkills: true },
        baseDeps({
          ecosystemProbe: async () => ({ present: true, version: 'codegraph 9.9.9' }),
          readRecord: emptyRecord,
        }),
      ),
    );
    expect(error.message).toContain('--yes');
  });

  it('still runs a selected xtarterize check instead of short-circuiting', async () => {
    await withConfigDir();
    const calls: string[][] = [];
    const result = await runSetup(
      { ecosystem: 'codegraph', json: true, quiet: true, xtarterizeSkills: true, yes: true },
      baseDeps({
        ecosystemProbe: async () => ({ present: true, version: 'codegraph 9.9.9' }),
        readRecord: emptyRecord,
        xtarterize: xtarterizeOk(calls),
      }),
    );
    expect(result.exitCode).toBe(0);
    expect(calls.length).toBeGreaterThan(0);
    expect(result.output).not.toContain('already set up');
  });

  it('does not short-circuit a fresh install when Maestria defaults are kept', async () => {
    await withConfigDir();
    const missingYes = await captureCliError(
      runSetup(
        { ecosystem: 'codegraph', quiet: true },
        baseDeps({
          ecosystemProbe: async () => ({ present: true, version: 'codegraph 9.9.9' }),
          readRecord: nullRecord,
        }),
      ),
    );
    expect(missingYes.message).toContain('--yes');

    const skillCalls: string[][] = [];
    const inner = fakeSkillCli({});
    const result = await runSetup(
      { ecosystem: 'codegraph', json: true, quiet: true, yes: true },
      baseDeps({
        ecosystemProbe: async () => ({ present: true, version: 'codegraph 9.9.9' }),
        readRecord: nullRecord,
        skillRunner: async (args, options) => {
          skillCalls.push([...args]);
          return await inner(args, options);
        },
      }),
    );
    expect(result.exitCode).toBe(0);
    expect(result.output).not.toContain('already set up');
    const maestria = actionsOf(result.output).filter((a) => a.category === 'maestria-skills');
    expect(maestria.length).toBeGreaterThan(0);
    expect(skillCalls.some((args) => args[0] === 'add')).toBe(true);
  });

  it('replays a no-op interactive run with review prompts only and annotated picker labels', async () => {
    await withConfigDir();
    setTty(true);
    interface PickerOption {
      hint?: string;
      label: string;
      value: string;
    }
    const captured: { message: string; options: Record<string, PickerOption[]> }[] = [];
    const skillCommands: string[] = [];
    const xtarterizeCalls: string[][] = [];
    const inner = fakeSkillCli({});
    // oxlint-disable-next-line require-await -- synchronous test stub by design.
    groupMocks.groupMultiselect.mockImplementation(
      async (opts: {
        initialValues?: string[];
        message: string;
        options?: Record<string, PickerOption[]>;
      }) => {
        if (opts.message.includes('Which setup items') && opts.options !== undefined) {
          captured.push({ message: opts.message, options: opts.options });
          return [];
        }
        return [...(opts.initialValues ?? [])];
      },
    );
    const result = await runSetup(
      { quiet: true },
      baseDeps({
        ecosystemProbe: async (tool) =>
          tool === 'codegraph'
            ? { present: true, version: 'codegraph 1.2.3' }
            : { present: false, version: '' },
        isInteractive: () => true,
        readRecord: emptyRecord,
        skillRunner: async (args, options) => {
          skillCommands.push(args[0] ?? '');
          return await inner(args, options);
        },
        xtarterize: xtarterizeOk(xtarterizeCalls),
      }),
    );
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('already set up');
    expect(groupMocks.groupMultiselect).toHaveBeenCalledTimes(2);
    expect(promptMocks.confirm).not.toHaveBeenCalled();
    expect(xtarterizeCalls.length).toBe(0);
    expect(skillCommands.every((command) => command === 'list')).toBe(true);
    const eco =
      captured[0]?.options['Ecosystem tools (detect only, manual install if missing)'] ?? [];
    expect(eco.find((o) => o.value === 'eco:codegraph')?.label).toContain('already installed');
    expect(eco.find((o) => o.value === 'eco:codegraph')?.hint).toContain('1.2.3');
    expect(eco.find((o) => o.value === 'eco:opensrc')?.label).toBe('opensrc');
  });
});
