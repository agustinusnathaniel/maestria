import { execFile } from 'node:child_process';
import path from 'node:path';
import { Effect } from 'effect';

import { resolveBatchQuiet } from '@/lib/batch-command.js';
import type { CommandResult } from '@/lib/command-result.js';
import { detectAll } from '@/lib/detect.js';
import { collectDoctorReports } from '@/lib/doctor.js';
import type { DoctorPlatformReport } from '@/lib/doctor.js';
import { executeSetupActions, KNOWN_ECOSYSTEM_TOOLS } from '@/lib/setup-actions.js';
import type { SetupActionContext } from '@/lib/setup-actions.js';
import {
  confirmSetupPlan,
  goalNotes,
  isNoopSetupPlan,
  NOOP_SETUP_SUMMARY,
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

const isInteractiveDefault = (): boolean => process.stdout.isTTY && process.stdin.isTTY;

const flattenSkillSource = (args: SetupArgs): string | string[] | undefined => {
  const kebab = args['skill-source'];
  if (Array.isArray(kebab) || typeof kebab === 'string') {
    return kebab;
  }
  return args.skillSource;
};

const defaultEcosystemProbe = async (
  tool: string,
): Promise<{ present: boolean; version: string }> => {
  try {
    const version = await Effect.runPromise(
      Effect.callback<string, Error>((resume) => {
        execFile(tool, ['--version'], { encoding: 'utf-8', timeout: 15_000 }, (error, stdout) => {
          if (error) {
            resume(Effect.fail(error));
            return;
          }
          resume(Effect.succeed(stdout.trim()));
        });
      }),
    );
    return { present: true, version: version.split('\n')[0] ?? '' };
  } catch {
    return { present: false, version: '' };
  }
};

const defaultXtarterizePath = async (): Promise<string | null> => {
  const present = await Effect.runPromise(commandExists('xtarterize'));
  if (!present) {
    return null;
  }
  try {
    const out = await Effect.runPromise(
      Effect.callback<string, Error>((resume) => {
        execFile(
          'which',
          ['xtarterize'],
          { encoding: 'utf-8', timeout: 10_000 },
          (error, stdout) => {
            if (error) {
              resume(Effect.fail(error));
              return;
            }
            resume(Effect.succeed(stdout.trim()));
          },
        );
      }),
    );
    return out === '' ? 'xtarterize' : (out.split('\n')[0] ?? 'xtarterize');
  } catch {
    return 'xtarterize';
  }
};

const defaultXtarterize: XtarterizeRunner = async (args, options) =>
  await Effect.runPromise(
    Effect.callback<XtarterizeResult>((resume) => {
      execFile(
        'xtarterize',
        [...args],
        { cwd: options?.cwd, encoding: 'utf-8', timeout: 120_000 },
        (error, stdout, stderr) => {
          const code =
            isRecord(error) && typeof error.code === 'number' && error.code !== 0 ? error.code : 1;
          resume(
            Effect.succeed({
              exitCode: error ? code : 0,
              stderr,
              stdout,
            }),
          );
        },
      );
    }),
  );

const defaultReadGitignore = async (cwd: string): Promise<string | null> => {
  try {
    const { readFile } = await import('node:fs/promises');
    return await readFile(path.join(cwd, '.gitignore'), 'utf-8');
  } catch {
    return null;
  }
};

interface SetupDetection {
  readonly doctor: DoctorPlatformReport[];
  readonly platforms: PlatformStatus[];
  readonly probes: Map<string, { present: boolean; version: string }>;
  readonly record: SkillsRecord | null;
  readonly xtarterizeOnPath: string | null;
}

const collectDetection = async (
  detect: () => Promise<PlatformStatus[]>,
  readRecord: () => Promise<SkillsRecord | null>,
  skillRunner: SkillCommandRunner,
  resolveXtarterizePath: () => Promise<string | null>,
  probe: (tool: string) => Promise<{ present: boolean; version: string }>,
  isQuiet: boolean,
): Promise<SetupDetection> => {
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

const toDetectionContext = (
  detection: SetupDetection,
  selection: SetupSelection,
): {
  doctor: DoctorPlatformReport[];
  ecosystem: { present: boolean; tool: string; version: string }[];
  recordPresent: boolean;
  xtarterizeOnPath: string | null;
} => ({
  doctor: detection.doctor,
  ecosystem: selection.ecosystem.map((tool) => ({
    present: detection.probes.get(tool)?.present ?? false,
    tool,
    version: detection.probes.get(tool)?.version ?? '',
  })),
  recordPresent: detection.record !== null,
  xtarterizeOnPath: detection.xtarterizeOnPath,
});

const executeConfirmedPlan = async (
  args: SetupArgs,
  cwd: string,
  installed: readonly PlatformStatus[],
  detection: SetupDetection,
  selection: SetupSelection,
  runners: Pick<SetupActionContext, 'readGitignore' | 'skillRunner' | 'xtarterize'>,
): Promise<CommandResult> => {
  const ctx: SetupActionContext = {
    cwd,
    excludeSkills: args.excludeSkills,
    installed,
    maestriaSkills: selection.maestriaSkills,
    probes: detection.probes,
    readGitignore: runners.readGitignore,
    record: detection.record,
    skillRunner: runners.skillRunner,
    xtarterize: runners.xtarterize,
    xtarterizeOnPath: detection.xtarterizeOnPath,
  };
  const reports = await executeSetupActions(ctx, selection);
  const notes = goalNotes(installed);
  const output = renderSetupOutput(
    { json: args.json },
    {
      cwd,
      detection: toDetectionContext(detection, selection),
      notes,
      reports,
    },
  );
  return { exitCode: reports.some((r) => r.status === 'failed') ? 1 : 0, output };
};

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
    flattenSkillSource,
  );

  if (selection.maestriaActive && selection.targets.length > 0) {
    await preflightCompanionOwnership(skillRunner, detection.record, selection.reviewed);
  }
  if (isNoopSetupPlan(selection, detection.probes)) {
    return {
      exitCode: 0,
      output: renderSetupOutput(
        { json: args.json },
        {
          cwd,
          detection: toDetectionContext(detection, selection),
          notes: goalNotes(installed),
          reports: [],
          summary: NOOP_SETUP_SUMMARY,
        },
      ),
    };
  }
  await confirmSetupPlan(cwd, selection, args.yes);
  return await executeConfirmedPlan(args, cwd, installed, detection, selection, {
    readGitignore,
    skillRunner,
    xtarterize,
  });
};
