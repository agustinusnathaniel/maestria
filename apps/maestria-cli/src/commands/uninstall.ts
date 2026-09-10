import { cancel, isCancel, select } from '@clack/prompts';
import { defineCommand } from 'citty';
import { Effect } from 'effect';

import { toCommandRun } from '@/lib/command-runner.js';
import { CliError } from '@/lib/command-result.js';
import type { CommandResult } from '@/lib/command-result.js';
import { detectInstalled } from '@/lib/detect.js';
import { createSpinner, renderCompactResults, renderResults } from '@/lib/output.js';
import { getPlatform, getPlatformOrResult, platforms } from '@/lib/platforms.js';
import { uninstallOne } from '@/lib/platform-transaction.js';
import { exitCodeForResults } from '@/lib/result-exit.js';
import { VALID_PLATFORMS } from '@/lib/validation.js';
import type { PlatformResult } from '@/types.js';

export interface UninstallArgs {
  all?: boolean;
  compact?: boolean;
  json?: boolean;
  platform?: string;
  quiet?: boolean;
}

const renderUninstallOutput = (
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

const uninstallSelected = async (
  selections: { id: string; label?: string }[],
  isQuiet: boolean,
): Promise<PlatformResult[]> =>
  await Effect.runPromise(
    Effect.all(
      selections.map(({ id, label }) => {
        const platform = getPlatformOrResult(id, label);
        return 'ok' in platform ? Effect.succeed(platform) : uninstallOne(platform, isQuiet);
      }),
      { concurrency: 1 },
    ),
  );

const runUninstallAll = async (isQuiet: boolean): Promise<PlatformResult[] | CommandResult> => {
  const spinner = createSpinner(isQuiet);
  spinner.start('Detecting platforms...');
  const installed = await Effect.runPromise(detectInstalled());
  spinner.stop('Done');
  if (installed.length === 0) {
    return {
      exitCode: 0,
      output: 'No maestria installations found to uninstall.',
    };
  }
  return await uninstallSelected(
    installed.map((p) => ({ id: p.id, label: p.label })),
    isQuiet,
  );
};

const runUninstallInteractive = async (
  isQuiet: boolean,
): Promise<PlatformResult[] | CommandResult> => {
  if (!process.stdout.isTTY || !process.stdin.isTTY) {
    throw new CliError(
      [
        'No platform specified and not in an interactive terminal.',
        'Usage: maestria uninstall <platform> or maestria uninstall --all',
        "Run 'maestria uninstall --help' for details.",
      ].join('\n'),
      1,
    );
  }
  const spinner = createSpinner(isQuiet);
  spinner.start('Detecting platforms...');
  const installed = await Effect.runPromise(detectInstalled());
  spinner.stop('Done');
  if (installed.length === 0) {
    return {
      exitCode: 0,
      output: 'No maestria installations found to uninstall.',
    };
  }
  const selected = await select({
    message: 'Which platform do you want to uninstall maestria for?',
    options: installed.map((p) => ({ label: p.label, value: p.id })),
  });
  if (isCancel(selected) || !selected) {
    cancel('Uninstall cancelled.');
    throw new CliError('', 130);
  }
  return await uninstallSelected([{ id: selected }], isQuiet);
};

export const handleUninstall = async (args: UninstallArgs): Promise<CommandResult> => {
  const isQuiet = args.quiet === true || args.compact === true;
  let results: PlatformResult[];
  if (args.platform !== undefined && args.platform !== null && args.platform !== '') {
    const platform = getPlatform(args.platform);
    if (!platform) {
      throw new CliError(
        `Unknown platform: ${args.platform}\nAvailable: ${platforms.map((p) => p.id).join(', ')}`,
        1,
      );
    }
    results = [await Effect.runPromise(uninstallOne(platform, isQuiet))];
  } else if (args.all === true) {
    const outcome = await runUninstallAll(isQuiet);
    if (!Array.isArray(outcome)) {
      return outcome;
    }
    results = outcome;
  } else {
    const outcome = await runUninstallInteractive(isQuiet);
    if (!Array.isArray(outcome)) {
      return outcome;
    }
    results = outcome;
  }
  return { exitCode: exitCodeForResults(results), output: renderUninstallOutput(results, args) };
};

export const uninstallCommand = defineCommand({
  args: {
    all: {
      alias: 'a',
      default: false,
      description: 'Uninstall all installed platforms',
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
      description: `Platform to uninstall. One of: ${VALID_PLATFORMS.join(', ')}. Pass directly to skip interactive selection.`,
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
    description: 'Uninstall maestria plugins for coding agent platforms',
    name: 'uninstall',
  },
  run: toCommandRun(handleUninstall),
});
