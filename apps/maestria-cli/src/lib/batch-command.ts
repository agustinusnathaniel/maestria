import { Effect } from 'effect';

import { CliError } from '@/lib/command-result.js';
import type { CommandResult } from '@/lib/command-result.js';
import { renderCompactResults, renderResults } from '@/lib/output.js';
import { getPlatformOrResult } from '@/lib/platforms.js';
import type { PlatformHandler } from '@/lib/platforms.js';
import { exitCodeForResults } from '@/lib/result-exit.js';
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
