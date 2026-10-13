import { cancel, isCancel } from '@clack/prompts';
import { defineCommand } from 'citty';

import {
  assertInteractiveTerminal,
  batchCommandResult,
  detectWithSpinner,
  resolveBatchQuiet,
  runBatchSelected,
} from '@/lib/batch-command.js';
import { toCommandRun } from '@/lib/command-runner.js';
import { CliError } from '@/lib/command-result.js';
import type { CommandResult } from '@/lib/command-result.js';
import { detectAll } from '@/lib/detect.js';
import { groupMultiselect } from '@/lib/group-multiselect.js';
import { installOne } from '@/lib/platform-transaction.js';
import { assertNoRemovedSkillFlags } from '@/lib/skill-reconcile.js';
import { VALID_PLATFORMS, validateOrThrow, validatePlatforms } from '@/lib/validation.js';

export interface InstallArgs {
  all?: boolean;
  compact?: boolean;
  json?: boolean;
  platform?: string;
  quiet?: boolean;
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
    const detected = await detectWithSpinner(isQuiet, detectAll({ includeLatest: false }));
    const toInstall = detected
      .filter((s) => s.available && !s.installed)
      .map((p) => ({ id: p.id, label: p.label }));
    if (toInstall.length === 0) {
      return {
        exitCode: 0,
        output: 'All detected platforms already have maestria installed.',
      };
    }
    return toInstall;
  }
  assertInteractiveTerminal('install');
  const allPlatforms = await detectWithSpinner(isQuiet, detectAll({ includeLatest: false }));
  const installable = allPlatforms
    .filter((s) => s.available && !s.installed)
    .map((p) => ({ id: p.id, label: p.label }));
  if (installable.length === 0) {
    return {
      exitCode: 0,
      output: allPlatforms.every((s) => !s.available)
        ? 'No supported coding agent platforms detected on this machine.'
        : 'maestria is already installed for all detected platforms.',
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
  assertNoRemovedSkillFlags(rawArgs);
  const isQuiet = resolveBatchQuiet(rawArgs);
  let platformIds: string[] | undefined;
  if (rawArgs.platform !== undefined && rawArgs.platform !== null && rawArgs.platform !== '') {
    platformIds = await validateOrThrow(validatePlatforms(rawArgs.platform));
  }

  const targets = await collectInstallTargets(platformIds, rawArgs.all === true, isQuiet);
  if (!Array.isArray(targets)) {
    return targets;
  }
  // Install runs the plugin batch only: maestria packages bundle their own
  // skills, so no companion-skill step remains.
  const results = await runBatchSelected(targets, isQuiet, installOne);
  return batchCommandResult(results, rawArgs);
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
  },
  meta: {
    description: 'Install maestria plugins for coding agent platforms',
    name: 'install',
  },
  run: toCommandRun(handleInstall),
});
