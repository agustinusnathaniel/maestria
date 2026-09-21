import { defineCommand } from 'citty';
import { Effect } from 'effect';
import picocolors from 'picocolors';

import { toCommandRun } from '@/lib/command-runner.js';
import type { CommandResult } from '@/lib/command-result.js';
import { detectAll } from '@/lib/detect.js';
import { collectDoctorReports, redactHome } from '@/lib/doctor.js';
import type { DoctorOutput, DoctorPlatformReport } from '@/lib/doctor.js';
import { createSpinner } from '@/lib/output.js';
import { defaultSkillRunner } from '@/lib/skill-reconcile.js';
import type { SkillCommandRunner } from '@/lib/skill-companion.js';
import { getSkillsRecordPath, readSkillsRecord } from '@/lib/skills.js';
import type { PlatformStatus } from '@/types.js';

export interface DoctorArgs {
  compact?: boolean;
  json?: boolean;
  quiet?: boolean;
}

/** Test seam: production uses live detection plus the real skills CLI runner. */
export interface DoctorDeps {
  detect?: () => Promise<PlatformStatus[]>;
  runner?: SkillCommandRunner;
}

const formatRecorded = (recorded: readonly string[] | null): string => {
  if (recorded === null) {
    return 'none recorded';
  }
  if (recorded.length === 0) {
    return 'none';
  }
  return recorded.join(', ');
};

const formatPlugin = (p: DoctorPlatformReport): string => {
  if (!p.available) {
    return 'CLI not available';
  }
  if (!p.installed) {
    return 'not installed';
  }
  if (p.installedVersion === '') {
    return 'installed';
  }
  return `installed ${p.installedVersion}`;
};

const formatObserved = (p: DoctorPlatformReport): string => {
  if (p.agent === null) {
    return 'no skills-CLI target';
  }
  if (p.listError !== undefined) {
    return 'check failed';
  }
  if (p.observed.length === 0) {
    return `none (${p.agent})`;
  }
  return p.observed.map((e) => `${e.name} @ ${e.path}`).join(', ');
};

const renderDoctorTable = (output: DoctorOutput): string => {
  const lines: string[] = [
    picocolors.bold('\n  Maestria Doctor'),
    picocolors.dim('  ─────────────────────────────────────'),
    `  Record: ${output.recordPresent ? output.recordPath : `${output.recordPath} (absent)`}`,
  ];
  for (const p of output.platforms) {
    lines.push(
      `  ${picocolors.bold(p.label)} (${p.id})`,
      `    Plugin:    ${formatPlugin(p)}`,
      `    Recorded:  ${formatRecorded(p.recorded)}`,
      `    Observed:  ${formatObserved(p)}`,
    );
    for (const note of p.notes) {
      lines.push(`    Note:      ${note}`);
    }
    for (const item of p.next) {
      lines.push(`    Next:      ${item}`);
    }
  }
  return `${lines.join('\n')}\n`;
};

const compactPlugin = (p: DoctorPlatformReport): string => {
  if (!p.available) {
    return 'unavailable';
  }
  if (p.installed) {
    return 'installed';
  }
  return 'not-installed';
};

const renderCompactDoctor = (output: DoctorOutput): string =>
  `${output.platforms
    .map((p: DoctorPlatformReport) => {
      const recorded = p.recorded === null ? 'recorded=none' : `recorded=${p.recorded.join(',')}`;
      const observed =
        p.observed.length === 0
          ? 'observed=none'
          : `observed=${p.observed.map((e) => e.name).join(',')}`;
      const flags = [
        ...(p.unmanaged.length > 0 ? [`unmanaged=${p.unmanaged.join(',')}`] : []),
        ...(p.missing.length > 0 ? [`missing=${p.missing.join(',')}`] : []),
      ].join(' ');
      return `${p.id}: ${compactPlugin(p)} ${recorded} ${observed}${flags === '' ? '' : ` ${flags}`}`;
    })
    .join('\n')}\n`;

export const handleDoctor = async (
  args: DoctorArgs,
  deps: DoctorDeps = {},
): Promise<CommandResult> => {
  const isQuiet = args.quiet === true || args.compact === true;
  const spinner = createSpinner(isQuiet);
  spinner.start('Checking skill setup...');

  // Corrupt records fail loud before any observation below.
  const recordPath = redactHome(getSkillsRecordPath());
  const record = await readSkillsRecord();
  const statuses =
    deps.detect === undefined ? await Effect.runPromise(detectAll()) : await deps.detect();
  const platforms = await collectDoctorReports(deps.runner ?? defaultSkillRunner, statuses, record);
  const output: DoctorOutput = {
    platforms,
    recordPath,
    recordPresent: record !== null,
  };

  let rendered: string;
  if (args.json === true) {
    spinner.stop('');
    rendered = JSON.stringify(output, null, 2);
  } else if (args.compact === true) {
    spinner.stop('');
    rendered = renderCompactDoctor(output);
  } else {
    spinner.stop('Done');
    rendered = renderDoctorTable(output);
  }
  return { exitCode: 0, output: rendered };
};

export const doctorCommand = defineCommand({
  args: {
    compact: {
      default: false,
      description: 'Minimal machine-friendly text output. One line per platform.',
      type: 'boolean',
    },
    json: {
      default: false,
      description:
        'Output skill diagnostics as JSON - structured machine-readable format optimized for AI agents and CI pipelines',
      type: 'boolean',
    },
    quiet: {
      default: false,
      description: 'Suppress spinner. Recommended for CI and non-interactive usage.',
      type: 'boolean',
    },
  },
  meta: {
    description: 'Diagnose skill setup without changing anything (read-only)',
    name: 'doctor',
  },
  run: toCommandRun(handleDoctor),
});
