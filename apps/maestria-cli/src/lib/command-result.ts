import type { PlatformResult } from '@/types.js';

export interface CommandResult {
  output: string;
  exitCode: number;
}

/** Handler-level failure carrying the exit code the CLI boundary should use. */
export class CliError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode: number) {
    super(message);
    this.name = 'CliError';
    this.exitCode = exitCode;
  }
}

/** Batch exit code: 0 when every result succeeded, 1 when any failed. */
export const exitCodeForResults = (results: PlatformResult[]): number =>
  results.every((r) => r.ok) ? 0 : 1;
