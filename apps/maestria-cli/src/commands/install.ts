import { cancel, isCancel } from '@clack/prompts';
import { defineCommand } from 'citty';

import {
  assertInteractiveTerminal,
  detectInstallable,
  detectWithSpinner,
  resolveBatchQuiet,
} from '@/lib/batch-command.js';
import { toCommandRun } from '@/lib/command-runner.js';
import { CliError } from '@/lib/command-result.js';
import type { CommandResult } from '@/lib/command-result.js';
import { detectAll } from '@/lib/detect.js';
import { groupMultiselect } from '@/lib/group-multiselect.js';
import { installOne } from '@/lib/platform-transaction.js';
import { normalizeSkillArgs, runSkillBatch } from '@/lib/skill-reconcile.js';
import { readSkillsRecord, validateSkillFlags } from '@/lib/skills.js';
import { VALID_PLATFORMS, validateOrThrow, validatePlatforms } from '@/lib/validation.js';

export interface InstallArgs {
  all?: boolean;
  compact?: boolean;
  excludeSkills?: string;
  json?: boolean;
  platform?: string;
  quiet?: boolean;
  skills?: string;
  yes?: boolean;
}

const collectInstallTargets = async (
  platformIds: string[] | undefined,
  all: boolean,
  isQuiet: boolean,
): Promise<{ id: string; label?: string }[] | CommandResult> => {
  if (platformIds && platformIds.length > 0) {
    return platformIds.map((id) => ({ id }));
  }
  if (all) {
    const toInstall = await detectInstallable(isQuiet);
    if (toInstall.length === 0) {
      return {
        exitCode: 0,
        output: 'All detected platforms already have maestria installed.',
      };
    }
    return toInstall;
  }
  assertInteractiveTerminal('install');
  const allPlatforms = await detectWithSpinner(isQuiet, detectAll());
  const installable = allPlatforms
    .filter((s) => s.available && !s.installed)
    .map((p) => ({ id: p.id, label: p.label }));
  if (installable.length === 0) {
    return {
      exitCode: 0,
      output: allPlatforms.every((s) => !s.available)
        ? 'No supported coding agent platforms detected on this machine.'
        : 'Maestria is already installed for all detected platforms.',
    };
  }
  const selected = await groupMultiselect({
    message: 'Which platforms do you want to install maestria for?',
    options: {
      'All platforms': installable.map((p) => ({ label: p.label, value: p.id })),
    },
    required: true,
    selectableGroups: true,
  });
  if (isCancel(selected) || !Array.isArray(selected) || selected.length === 0) {
    cancel('Install cancelled.');
    throw new CliError('', 130);
  }
  return selected.map((id) => ({ id }));
};

export const handleInstall = async (rawArgs: InstallArgs): Promise<CommandResult> => {
  const args = normalizeSkillArgs(rawArgs);
  const isQuiet = resolveBatchQuiet(args);
  let platformIds: string[] | undefined;
  if (args.platform !== undefined && args.platform !== null && args.platform !== '') {
    platformIds = await validateOrThrow(validatePlatforms(args.platform));
  }
  const record = await readSkillsRecord();
  validateSkillFlags(platformIds ?? [], args, record);

  const targets = await collectInstallTargets(platformIds, args.all === true, isQuiet);
  if (!Array.isArray(targets)) {
    return targets;
  }
  return await runSkillBatch(targets, record, 'Install', args, isQuiet, installOne);
};

export const installCommand = defineCommand({
  args: {
    all: {
      alias: 'a',
      default: false,
      description: 'Install for all detected platforms that are not yet installed',
      type: 'boolean',
    },
    compact: {
      default: false,
      description: 'Minimal machine-friendly text output. Strips colors and decorative formatting.',
      type: 'boolean',
    },
    'exclude-skills': {
      description:
        'Methodology skills to skip (CSV). Never touches independently installed copies.',
      required: false,
      type: 'string',
    },
    json: {
      default: false,
      description:
        'Output results as JSON - structured machine-readable format optimized for AI agents and CI pipelines',
      type: 'boolean',
    },
    platform: {
      description:
        `Platform(s) to install. Comma-separated for multiple (e.g., opencode,pi). ` +
        `One of: ${VALID_PLATFORMS.join(', ')}. ` +
        'Pass directly to skip interactive selection.',
      required: false,
      type: 'positional',
    },
    quiet: {
      default: false,
      description:
        'Suppress spinner and non-essential output. Recommended for CI and non-interactive usage.',
      type: 'boolean',
    },
    skills: {
      description:
        "Methodology skills to activate (CSV, or 'none' for no skills). Default: create-pull-request, docs-update. Known: create-pull-request, docs-update. Validated before any change.",
      required: false,
      type: 'string',
    },
    yes: {
      alias: 'y',
      default: false,
      description:
        'Confirm skill selection non-interactively (required for non-TTY when it changes).',
      type: 'boolean',
    },
  },
  meta: {
    description: 'Install maestria plugins for coding agent platforms',
    name: 'install',
  },
  run: toCommandRun(handleInstall),
});
