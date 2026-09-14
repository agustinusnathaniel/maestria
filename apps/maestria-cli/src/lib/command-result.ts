/** Result a command handler returns for the CLI boundary to print and exit with. */
import type { PlatformResult } from '@/types.js';

export interface CommandResult {
  output: string;
  exitCode: number;
}

/**
 * Handler-level failure carrying the exit code the CLI boundary should use.
 * The boundary prints `message` to stderr when non-empty.
 */
export class CliError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode: number) {
    super(message);
    this.name = 'CliError';
    this.exitCode = exitCode;
  }
}

/**
 * Exit code for a batch of per-platform results: 0 when every result
 * succeeded (or the batch is empty), 1 when any result failed.
 *
 * Mirrors the documented CLI exit-code contract (0 = success, 1 = command
 * error) so install/update/uninstall expose partial failures to CI and
 * AI-agent consumers instead of always exiting 0.
 */
export const exitCodeForResults = (results: PlatformResult[]): number =>
  results.every((r) => r.ok) ? 0 : 1;
