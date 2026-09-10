import { CliError } from './command-result.js';
import type { CommandResult } from './command-result.js';

export type CommandHandler<Args> = (args: Args) => Promise<CommandResult>;

/**
 * Adapt a command handler to a citty `run` function.
 *
 * The runner is the single place that prints a handler's result and records
 * its exit code. A `CliError` becomes stderr text plus its exit code; any
 * other error rethrows to the outer boundary.
 */
export const toCommandRun =
  <Args>(handler: CommandHandler<Args>) =>
  async ({ args }: { args: Args }): Promise<void> => {
    try {
      const result = await handler(args);
      if (result.output !== '') {
        console.log(result.output);
      }
      process.exitCode = result.exitCode;
    } catch (error: unknown) {
      if (!(error instanceof CliError)) {
        throw error;
      }
      if (error.message !== '') {
        console.error(error.message);
      }
      process.exitCode = error.exitCode;
    }
  };
