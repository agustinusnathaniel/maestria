import { defineCommand } from 'citty';
import { Effect } from 'effect';
import picocolors from 'picocolors';

import { toCommandRun } from '@/lib/command-runner.js';
import { CliError } from '@/lib/command-result.js';
import type { CommandResult } from '@/lib/command-result.js';
import { detectAll } from '@/lib/detect.js';
import { collectDoctorReports, redactHome } from '@/lib/doctor.js';
import type { DoctorOutput, DoctorPlatformReport } from '@/lib/doctor.js';
import { createSpinner } from '@/lib/output.js';
import { defaultSkillRunner } from '@/lib/skill-reconcile.js';
import { MANAGED_SKILLS } from '@/lib/skill-companion.js';
import type { SkillCommandRunner } from '@/lib/skill-companion.js';
import { getSkillsRecordPath, readSkillsRecord } from '@/lib/skills.js';
import type { PlatformStatus } from '@/types.js';

export interface DoctorArgs {
  compact?: boolean;
  json?: boolean;
  quiet?: boolean;
}

export interface DoctorDeps {
  detect?: () => Promise<PlatformStatus[]>;
  runner?: SkillCommandRunner;
}

const INSTALL_PLUGIN_HINT = 'to install the plugin';
const RECORD_SELECTION_HINT = 'to record a selection';

/**
 * Human table shows one actionable step per platform. Priority: an uninstalled
 * plugin blocks everything else, then a missing record, otherwise the first
 * accumulated step (share, exclude, restore, re-run, manual). The JSON output
 * keeps the full `next` array as the machine contract.
 */
const selectDisplayNext = (platform: DoctorPlatformReport): string[] => {
  if (platform.next.length <= 1) {
    return platform.next;
  }
  if (platform.available && !platform.installed) {
    const install = platform.next.find((item) => item.includes(INSTALL_PLUGIN_HINT));
    if (install !== undefined) {
      return [install];
    }
  }
  if (platform.recorded === null) {
    const record = platform.next.find((item) => item.includes(RECORD_SELECTION_HINT));
    if (record !== undefined) {
      return [record];
    }
  }
  return platform.next.slice(0, 1);
};

const omittedLine = (count: number): string =>
  count === 1
    ? '1 unrelated skill omitted, see --json for the full list.'
    : `${count} unrelated skills omitted, see --json for the full list.`;

const pluginText = (platform: DoctorPlatformReport): string => {
  if (!platform.available) {
    return 'CLI not available';
  }
  if (!platform.installed) {
    return 'not installed';
  }
  return platform.installedVersion === '' ? 'installed' : `installed ${platform.installedVersion}`;
};

const recordedText = (platform: DoctorPlatformReport): string => {
  if (platform.recorded === null) {
    return 'none recorded';
  }
  return platform.recorded.length === 0 ? 'none' : platform.recorded.join(', ');
};

interface ObservedText {
  readonly omitted: number;
  readonly text: string;
}

/**
 * Human table shows managed skills only; unrelated skills collapse to a
 * count. Platforms sharing one agent inventory render it once and reference
 * the first platform afterwards. JSON keeps the full `observed` arrays.
 */
const observedText = (
  platform: DoctorPlatformReport,
  firstByAgent: Map<string, string>,
): ObservedText => {
  if (platform.agent === null) {
    return { omitted: 0, text: 'no skills-CLI target' };
  }
  if (platform.listError !== undefined) {
    return { omitted: 0, text: 'check failed' };
  }
  const first = firstByAgent.get(platform.agent);
  if (first !== undefined) {
    return { omitted: 0, text: `same as ${first}` };
  }
  firstByAgent.set(platform.agent, platform.id);
  const managed = platform.observed.filter((e) => MANAGED_SKILLS.includes(e.name));
  const omitted = platform.observed.length - managed.length;
  if (managed.length === 0) {
    return {
      omitted,
      text: omitted === 0 ? `none (${platform.agent})` : `none managed (${platform.agent})`,
    };
  }
  return { omitted, text: managed.map((e) => `${e.name} @ ${e.path}`).join(', ') };
};

const renderPlatformSection = (
  platform: DoctorPlatformReport,
  firstByAgent: Map<string, string>,
): string[] => {
  const observed = observedText(platform, firstByAgent);
  const lines = [
    `  ${picocolors.bold(platform.label)} (${platform.id})`,
    `    Plugin:    ${pluginText(platform)}`,
    `    Recorded:  ${recordedText(platform)}`,
    `    Observed:  ${observed.text}`,
  ];
  if (observed.omitted > 0) {
    lines.push(`    Omitted:   ${omittedLine(observed.omitted)}`);
  }
  for (const note of platform.notes) {
    lines.push(`    Note:      ${note}`);
  }
  for (const item of selectDisplayNext(platform)) {
    lines.push(`    Next:      ${item}`);
  }
  return lines;
};

const renderDoctorTable = (output: DoctorOutput): string => {
  const lines: string[] = [
    picocolors.bold('\n  Maestria Doctor'),
    picocolors.dim('  ─────────────────────────────────────'),
    `  Record: ${output.recordPresent ? output.recordPath : `${output.recordPath} (absent)`}`,
  ];
  const firstByAgent = new Map<string, string>();
  for (const p of output.platforms) {
    lines.push(...renderPlatformSection(p, firstByAgent));
  }
  return `${lines.join('\n')}\n`;
};

export const handleDoctor = async (
  args: DoctorArgs,
  deps: DoctorDeps = {},
): Promise<CommandResult> => {
  // The global root --compact flag parses everywhere, but doctor has no compact
  // rendering; fail loud before any detection or observation below.
  if (args.compact === true) {
    throw new CliError(
      args.quiet === true
        ? ''
        : "--compact is not supported for 'maestria doctor'. Use --json or --quiet instead.",
      1,
    );
  }
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
