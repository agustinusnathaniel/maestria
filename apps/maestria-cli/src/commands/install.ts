import { cancel, isCancel } from '@clack/prompts';
import { defineCommand } from 'citty';
import { Effect } from 'effect';

import { toCommandRun } from '@/lib/command-runner.js';
import { CliError } from '@/lib/command-result.js';
import type { CommandResult } from '@/lib/command-result.js';
import { detectAll } from '@/lib/detect.js';
import { groupMultiselect } from '@/lib/group-multiselect.js';
import { createSpinner, renderCompactResults, renderResults } from '@/lib/output.js';
import { getPlatformOrResult } from '@/lib/platforms.js';
import { installOne } from '@/lib/platform-transaction.js';
import { exitCodeForResults } from '@/lib/result-exit.js';
import { VALID_PLATFORMS, validateOrThrow, validatePlatforms } from '@/lib/validation.js';
import type { PlatformResult } from '@/types.js';

export interface InstallArgs {
  all?: boolean;
  compact?: boolean;
  json?: boolean;
  platform?: string;
  quiet?: boolean;
}

const renderInstallOutput = (
  results: PlatformResult[],
  args: { compact?: boolean; json?: boolean },
): string => {
  if (args.json === true) {
    return JSON.stringify(results, null, 2);
  }
  if (args.compact === true) {
    return renderCompactResults(results);
  }
  return renderResults(results);
};

const installSelected = async (
  selections: { id: string; label?: string }[],
  isQuiet: boolean,
): Promise<PlatformResult[]> =>
  await Effect.runPromise(
    Effect.all(
      selections.map(({ id, label }) => {
        const platform = getPlatformOrResult(id, label);
        return 'ok' in platform ? Effect.succeed(platform) : installOne(platform, isQuiet);
      }),
      { concurrency: 1 },
    ),
  );

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
  return await installSelected(
    toInstall.map((p) => ({ id: p.id, label: p.label })),
    isQuiet,
  );
};

const runInstallInteractive = async (
  isQuiet: boolean,
): Promise<PlatformResult[] | CommandResult> => {
  if (!process.stdout.isTTY || !process.stdin.isTTY) {
    throw new CliError(
      [
        'No platform specified and not in an interactive terminal.',
        'Usage: maestria install <platform> or maestria install --all',
        "Run 'maestria install --help' for details.",
      ].join('\n'),
      1,
    );
  }
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
  return await installSelected(
    selected.map((id) => ({ id })),
    isQuiet,
  );
};

export const handleInstall = async (args: InstallArgs): Promise<CommandResult> => {
  const isQuiet = args.quiet === true || args.compact === true;
  let platformIds: string[] | undefined;
  if (args.platform !== undefined && args.platform !== null && args.platform !== '') {
    platformIds = await validateOrThrow(validatePlatforms(args.platform));
  }
  let results: PlatformResult[];
  if (platformIds && platformIds.length > 0) {
    results = await installSelected(
      platformIds.map((id) => ({ id })),
      isQuiet,
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
  return { exitCode: exitCodeForResults(results), output: renderInstallOutput(results, args) };
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
