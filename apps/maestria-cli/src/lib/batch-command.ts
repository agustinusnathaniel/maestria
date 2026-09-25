import { Effect } from 'effect';

import { CliError, exitCodeForResults } from '@/lib/command-result.js';
import type { CommandResult } from '@/lib/command-result.js';
import { detectInstalled } from '@/lib/detect.js';
import { createSpinner, renderCompactResults, renderResults } from '@/lib/output.js';
import { getPlatformOrResult } from '@/lib/platforms.js';
import type { PlatformHandler } from '@/lib/platforms.js';
import type { PlatformResult } from '@/types.js';

export interface BatchCommandArgs {
  compact?: boolean;
  json?: boolean;
  quiet?: boolean;
}

export interface BatchSelection {
  id: string;
  label?: string;
}

export const resolveBatchQuiet = (args: BatchCommandArgs): boolean =>
  args.quiet === true || args.compact === true;

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

export const batchCommandResult = (
  results: PlatformResult[],
  args: BatchCommandArgs,
): CommandResult => ({
  exitCode: exitCodeForResults(results),
  output: renderBatchOutput(results, args),
});
