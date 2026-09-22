import { defineCommand } from 'citty';
import { Effect } from 'effect';
import picocolors from 'picocolors';

import { toCommandRun } from '@/lib/command-runner.js';
import type { CommandResult } from '@/lib/command-result.js';
import { detectAll } from '@/lib/detect.js';
import { collectDoctorReports, redactHome } from '@/lib/doctor.js';
import type { DoctorOutput } from '@/lib/doctor.js';
import { createSpinner } from '@/lib/output.js';
import { defaultSkillRunner } from '@/lib/skill-reconcile.js';
import type { SkillCommandRunner } from '@/lib/skill-companion.js';
import { getSkillsRecordPath, readSkillsRecord } from '@/lib/skills.js';
import type { PlatformStatus } from '@/types.js';

export interface DoctorArgs {
  json?: boolean;
  quiet?: boolean;
}

export interface DoctorDeps {
  detect?: () => Promise<PlatformStatus[]>;
  runner?: SkillCommandRunner;
}

const renderDoctorTable = (output: DoctorOutput): string => {
  const lines: string[] = [
    picocolors.bold('\n  Maestria Doctor'),
    picocolors.dim('  ─────────────────────────────────────'),
    `  Record: ${output.recordPresent ? output.recordPath : `${output.recordPath} (absent)`}`,
  ];
  for (const p of output.platforms) {
    let plugin: string;
    if (!p.available) {
      plugin = 'CLI not available';
    } else if (!p.installed) {
      plugin = 'not installed';
    } else if (p.installedVersion === '') {
      plugin = 'installed';
    } else {
      plugin = `installed ${p.installedVersion}`;
    }
    let recorded: string;
    if (p.recorded === null) {
      recorded = 'none recorded';
    } else if (p.recorded.length === 0) {
      recorded = 'none';
    } else {
      recorded = p.recorded.join(', ');
    }
    let observed: string;
    if (p.agent === null) {
      observed = 'no skills-CLI target';
    } else if (p.listError !== undefined) {
      observed = 'check failed';
    } else if (p.observed.length === 0) {
      observed = `none (${p.agent})`;
    } else {
      observed = p.observed.map((e) => `${e.name} @ ${e.path}`).join(', ');
    }
    lines.push(
      `  ${picocolors.bold(p.label)} (${p.id})`,
      `    Plugin:    ${plugin}`,
      `    Recorded:  ${recorded}`,
      `    Observed:  ${observed}`,
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

export const handleDoctor = async (
  args: DoctorArgs,
  deps: DoctorDeps = {},
): Promise<CommandResult> => {
  const spinner = createSpinner(args.quiet === true);
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
  } else {
    spinner.stop('Done');
    rendered = renderDoctorTable(output);
  }
  return { exitCode: 0, output: rendered };
};

export const doctorCommand = defineCommand({
  args: {
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
