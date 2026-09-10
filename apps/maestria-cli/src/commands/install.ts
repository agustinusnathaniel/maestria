import { cancel, isCancel } from '@clack/prompts';
import { defineCommand } from 'citty';
import { Effect } from 'effect';

import {
  assertInteractiveTerminal,
  batchCommandResult,
  resolveBatchQuiet,
  runBatchSelected,
} from '@/lib/batch-command.js';
import { toCommandRun } from '@/lib/command-runner.js';
import { CliError } from '@/lib/command-result.js';
import type { CommandResult } from '@/lib/command-result.js';
import { detectAll } from '@/lib/detect.js';
import { groupMultiselect } from '@/lib/group-multiselect.js';
import { createSpinner } from '@/lib/output.js';
import { installOne } from '@/lib/platform-transaction.js';
import { VALID_PLATFORMS, validateOrThrow, validatePlatforms } from '@/lib/validation.js';
import type { PlatformResult } from '@/types.js';

export interface InstallArgs {
  all?: boolean;
  compact?: boolean;
  json?: boolean;
  platform?: string;
  quiet?: boolean;
}

const runInstallAll = async (isQuiet: boolean): Promise<PlatformResult[] | CommandResult> => {
  const spinner = createSpinner(isQuiet);
  spinner.start('Detecting platforms...');
  const allPlatforms = await Effect.runPromise(detectAll());
  spinner.stop('Done');
  const toInstall = allPlatforms.filter((s) => s.available && !s.installed);
  if (toInstall.length === 0) {
    return {
      exitCode: 0,
      output: 'All detected platforms already have maestria installed.',
    };
  }
  return await runBatchSelected(
    toInstall.map((p) => ({ id: p.id, label: p.label })),
    isQuiet,
    installOne,
  );
};

const runInstallInteractive = async (
  isQuiet: boolean,
): Promise<PlatformResult[] | CommandResult> => {
  assertInteractiveTerminal('install');
  const spinner = createSpinner(isQuiet);
  spinner.start('Detecting platforms...');
  const allPlatforms = await Effect.runPromise(detectAll());
  spinner.stop('Done');
  const installable = allPlatforms.filter((s) => s.available && !s.installed);
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
  return await runBatchSelected(
    selected.map((id) => ({ id })),
    isQuiet,
    installOne,
  );
};

export const handleInstall = async (args: InstallArgs): Promise<CommandResult> => {
  const isQuiet = resolveBatchQuiet(args);
  let platformIds: string[] | undefined;
  if (args.platform !== undefined && args.platform !== null && args.platform !== '') {
    platformIds = await validateOrThrow(validatePlatforms(args.platform));
  }
  let results: PlatformResult[];
  if (platformIds && platformIds.length > 0) {
    results = await runBatchSelected(
      platformIds.map((id) => ({ id })),
      isQuiet,
      installOne,
    );
  } else if (args.all === true) {
    const outcome = await runInstallAll(isQuiet);
    if (!Array.isArray(outcome)) {
      return outcome;
    }
    results = outcome;
  } else {
    const outcome = await runInstallInteractive(isQuiet);
    if (!Array.isArray(outcome)) {
      return outcome;
    }
    results = outcome;
  }
  return batchCommandResult(results, args);
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
