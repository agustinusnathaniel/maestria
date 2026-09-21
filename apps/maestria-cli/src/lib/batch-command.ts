import { Effect } from 'effect';

import { CliError, exitCodeForResults } from '@/lib/command-result.js';
import type { CommandResult } from '@/lib/command-result.js';
import { detectAll, detectInstalled } from '@/lib/detect.js';
import { createSpinner, renderCompactResults, renderResults } from '@/lib/output.js';
import { getPlatformOrResult } from '@/lib/platforms.js';
import type { PlatformHandler } from '@/lib/platforms.js';
import type { PlatformResult } from '@/types.js';

/**
 * Shared skeleton for the install/update/uninstall batch commands.
 *
 * Each command keeps its own detection filters, prompts, and messages; this
 * module owns the pieces that must stay identical across them: quiet
 * resolution, result rendering, the concurrency-1 selection runner, and the
 * non-interactive usage guard.
 */

export interface BatchCommandArgs {
  compact?: boolean;
  json?: boolean;
  quiet?: boolean;
}

export interface BatchSelection {
  id: string;
  label?: string;
}

/** Quiet mode follows either explicit --quiet or machine-friendly --compact. */
export const resolveBatchQuiet = (args: BatchCommandArgs): boolean =>
  args.quiet === true || args.compact === true;

/** Render per-platform results as JSON, compact text, or the colored default. */
export const renderBatchOutput = (
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

/**
 * Run a per-platform operation for each selection, strictly one at a time so
 * lifecycle side effects keep a deterministic order.
 */
export const runBatchSelected = async (
  selections: readonly BatchSelection[],
  isQuiet: boolean,
  operation: (platform: PlatformHandler, isQuiet: boolean) => Effect.Effect<PlatformResult>,
): Promise<PlatformResult[]> =>
  await Effect.runPromise(
    Effect.all(
      selections.map(({ id, label }) => {
        const platform = getPlatformOrResult(id, label);
        return 'ok' in platform ? Effect.succeed(platform) : operation(platform, isQuiet);
      }),
      { concurrency: 1 },
    ),
  );

/** Run a detection effect behind the shared Detecting platforms spinner. */
export const detectWithSpinner = async <A>(
  isQuiet: boolean,
  effect: Effect.Effect<A>,
): Promise<A> => {
  const spinner = createSpinner(isQuiet);
  spinner.start('Detecting platforms...');
  const result = await Effect.runPromise(effect);
  spinner.stop('Done');
  return result;
};

/** Installable platforms (available, not yet installed) behind the shared spinner. */
export const detectInstallable = async (isQuiet: boolean): Promise<BatchSelection[]> => {
  const all = await detectWithSpinner(isQuiet, detectAll());
  return all.filter((s) => s.available && !s.installed).map((p) => ({ id: p.id, label: p.label }));
};

/**
 * Installed platforms behind the shared spinner, or the per-command empty
 * result. Callers pass their own empty message; prompts stay per command.
 */
export const detectInstalledOr = async (
  isQuiet: boolean,
  emptyOutput: string,
): Promise<BatchSelection[] | CommandResult> => {
  const installed = await detectWithSpinner(isQuiet, detectInstalled());
  if (installed.length === 0) {
    return { exitCode: 0, output: emptyOutput };
  }
  return installed.map((p) => ({ id: p.id, label: p.label }));
};

/** Throw the shared usage error when stdin/stdout is not an interactive terminal. */
export const assertInteractiveTerminal = (command: string): void => {
  if (!process.stdout.isTTY || !process.stdin.isTTY) {
    throw new CliError(
      [
        'No platform specified and not in an interactive terminal.',
        `Usage: maestria ${command} <platform> or maestria ${command} --all`,
        `Run 'maestria ${command} --help' for details.`,
      ].join('\n'),
      1,
    );
  }
};

/** Exit code plus rendered output for a completed batch selection. */
export const batchCommandResult = (
  results: PlatformResult[],
  args: BatchCommandArgs,
): CommandResult => ({
  exitCode: exitCodeForResults(results),
  output: renderBatchOutput(results, args),
});
