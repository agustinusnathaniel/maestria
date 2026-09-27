import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { Effect } from 'effect';

import { resolveBatchQuiet } from '@/lib/batch-command.js';
import type { CommandResult } from '@/lib/command-result.js';
import { detectAll } from '@/lib/detect.js';
import { collectDoctorReports } from '@/lib/doctor.js';
import { executeSetupActions, KNOWN_ECOSYSTEM_TOOLS } from '@/lib/setup-actions.js';
import type { SetupActionContext } from '@/lib/setup-actions.js';
import {
  confirmSetupPlan,
  goalNotes,
  isNoopSetupPlan,
  renderSetupOutput,
  resolveSetupPlan,
} from '@/lib/setup-plan.js';
import type { SetupSelection } from '@/lib/setup-plan.js';
import { defaultSkillRunner, preflightCompanionOwnership } from '@/lib/skill-reconcile.js';
import type { SkillCommandRunner } from '@/lib/skill-companion.js';
import { createSpinner } from '@/lib/output.js';
import { commandExists } from '@/lib/shell.js';
import { readSkillsRecord } from '@/lib/skills.js';
import type { SkillsRecord } from '@/lib/skills.js';
import { isRecord } from '@/lib/primitives.js';
import type { PlatformStatus } from '@/types.js';

export type SetupSkillScope = 'project' | 'global';

export interface SetupSkillSource {
  readonly source: string;
  readonly scope: SetupSkillScope;
}

export interface SetupActionReport {
  readonly category: string;
  readonly command?: string;
  readonly detail: string;
  readonly item: string;
  readonly status: 'ok' | 'failed' | 'skipped';
}

export interface SetupArgs {
  compact?: boolean;
  cwd?: string;
  ecosystem?: string;
  excludeSkills?: string;
  json?: boolean;
  maestriaSkills?: string;
  quiet?: boolean;
  skillSource?: string | string[];
  skills?: string;
  xtarterizeSkills?: boolean;
  yes?: boolean;
  [key: string]: unknown;
}

export interface SetupDeps {
  detect?: () => Promise<PlatformStatus[]>;
  ecosystemProbe?: (tool: string) => Promise<{ present: boolean; version: string }>;
  isInteractive?: () => boolean;
  readGitignore?: (cwd: string) => Promise<string | null>;
  readRecord?: () => Promise<SkillsRecord | null>;
  skillRunner?: SkillCommandRunner;
  xtarterize?: XtarterizeRunner;
  xtarterizePath?: () => Promise<string | null>;
}

export interface XtarterizeResult {
  readonly exitCode: number;
  readonly stderr: string;
  readonly stdout: string;
}

export type XtarterizeRunner = (
  args: readonly string[],
  options?: { cwd?: string },
) => Promise<XtarterizeResult>;

export { effectiveMaestriaSkills, parseEcosystem, parseSkillSources } from '@/lib/setup-plan.js';

// oxlint-disable-next-line strict-void-return -- Node provides a custom promisifier for execFile; its ChildProcess return is intentionally unused.
const execFileAsync = promisify(execFile);

const isInteractiveDefault = (): boolean => process.stdout.isTTY && process.stdin.isTTY;

const defaultEcosystemProbe = async (
  tool: string,
): Promise<{ present: boolean; version: string }> => {
  try {
    const { stdout } = await execFileAsync(tool, ['--version'], {
      encoding: 'utf-8',
      timeout: 15_000,
    });
    return { present: true, version: stdout.trim().split('\n')[0] ?? '' };
  } catch {
    return { present: false, version: '' };
  }
};

const defaultXtarterizePath = async (): Promise<string | null> => {
  try {
    const { stdout } = await execFileAsync('which', ['xtarterize'], {
      encoding: 'utf-8',
      timeout: 10_000,
    });
    return stdout.trim().split('\n')[0] || null;
  } catch {
    return (await Effect.runPromise(commandExists('xtarterize'))) ? 'xtarterize' : null;
  }
};

const defaultXtarterize: XtarterizeRunner = async (args, options) => {
  try {
    const { stderr, stdout } = await execFileAsync('xtarterize', [...args], {
      cwd: options?.cwd,
      encoding: 'utf-8',
      timeout: 120_000,
    });
    return { exitCode: 0, stderr, stdout };
  } catch (error) {
    const failed = isRecord(error) ? error : {};
    return {
      exitCode: typeof failed.code === 'number' && failed.code !== 0 ? failed.code : 1,
      stderr: typeof failed.stderr === 'string' ? failed.stderr : '',
      stdout: typeof failed.stdout === 'string' ? failed.stdout : '',
    };
  }
};

const defaultReadGitignore = async (cwd: string): Promise<string | null> => {
  try {
    const { readFile } = await import('node:fs/promises');
    return await readFile(path.join(cwd, '.gitignore'), 'utf-8');
  } catch {
    return null;
  }
};

const collectDetection = async (
  detect: () => Promise<PlatformStatus[]>,
  readRecord: () => Promise<SkillsRecord | null>,
  skillRunner: SkillCommandRunner,
  resolveXtarterizePath: () => Promise<string | null>,
  probe: (tool: string) => Promise<{ present: boolean; version: string }>,
  isQuiet: boolean,
) => {
  const spinner = createSpinner(isQuiet);
  spinner.start('Detecting setup state...');
  const platforms = await detect();
  const record = await readRecord();
  const doctor = await collectDoctorReports(skillRunner, platforms, record);
  const xtarterizeOnPath = await resolveXtarterizePath();
  const probes = new Map<string, { present: boolean; version: string }>();
  for (const tool of KNOWN_ECOSYSTEM_TOOLS) {
    // oxlint-disable-next-line no-await-in-loop -- sequential version probes keep output order deterministic.
    probes.set(tool, await probe(tool));
  }
  spinner.stop('Done');
  return { doctor, platforms, probes, record, xtarterizeOnPath };
};

const renderResult = (
  args: { cwd: string; json?: boolean; summary?: string },
  detection: Awaited<ReturnType<typeof collectDetection>>,
  selection: SetupSelection,
  installed: readonly PlatformStatus[],
  reports: SetupActionReport[],
): string =>
  renderSetupOutput(
    { json: args.json },
    {
      cwd: args.cwd,
      detection: {
        doctor: detection.doctor,
        ecosystem: selection.ecosystem.map((tool) => ({
          present: detection.probes.get(tool)?.present ?? false,
          tool,
          version: detection.probes.get(tool)?.version ?? '',
        })),
        recordPresent: detection.record !== null,
        xtarterizeOnPath: detection.xtarterizeOnPath,
      },
      notes: goalNotes(installed),
      reports,
      summary: args.summary,
    },
  );

// oxlint-disable-next-line max-lines-per-function -- keep setup preflight, confirmation, and execution order together.
export const runSetup = async (
  rawArgs: SetupArgs,
  deps: SetupDeps = {},
): Promise<CommandResult> => {
  const args = { ...rawArgs };
  const isQuiet = resolveBatchQuiet(args);
  const detect = deps.detect ?? (async () => await Effect.runPromise(detectAll()));
  const readRecord = deps.readRecord ?? readSkillsRecord;
  const skillRunner = deps.skillRunner ?? defaultSkillRunner;
  const xtarterize = deps.xtarterize ?? defaultXtarterize;
  const probe = deps.ecosystemProbe ?? defaultEcosystemProbe;
  const resolveXtarterizePath = deps.xtarterizePath ?? defaultXtarterizePath;
  const readGitignore = deps.readGitignore ?? defaultReadGitignore;
  const interactive = (deps.isInteractive ?? isInteractiveDefault)();

  const rawCwd = typeof args.cwd === 'string' ? args.cwd.trim() : '';
  const cwd = rawCwd === '' ? process.cwd() : rawCwd;

  const detection = await collectDetection(
    detect,
    readRecord,
    skillRunner,
    resolveXtarterizePath,
    probe,
    isQuiet,
  );
  const installed = detection.platforms.filter((p) => p.available && p.installed);
  const selection = await resolveSetupPlan(
    args,
    installed,
    detection.record,
    detection.xtarterizeOnPath,
    detection.probes,
    interactive,
  );
  if (selection.maestriaActive && selection.reviewed.length > 0) {
    await preflightCompanionOwnership(skillRunner, detection.record, selection.reviewed);
  }
  if (isNoopSetupPlan(selection, detection.probes)) {
    return {
      exitCode: 0,
      output: renderResult(
        { cwd, json: args.json, summary: 'Everything is already set up; nothing to do.' },
        detection,
        selection,
        installed,
        [],
      ),
    };
  }
  await confirmSetupPlan(cwd, selection, args.yes);
  const ctx: SetupActionContext = {
    cwd,
    excludeSkills: args.excludeSkills,
    installed,
    maestriaSkills: selection.maestriaSkills,
    probes: detection.probes,
    readGitignore,
    record: detection.record,
    skillRunner,
    xtarterize,
    xtarterizeOnPath: detection.xtarterizeOnPath,
  };
  const reports = await executeSetupActions(ctx, selection);
  return {
    exitCode: reports.some((report) => report.status === 'failed') ? 1 : 0,
    output: renderResult({ cwd, json: args.json }, detection, selection, installed, reports),
  };
};
