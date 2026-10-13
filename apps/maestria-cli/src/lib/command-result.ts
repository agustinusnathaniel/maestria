import type { PlatformResult } from '@/types.js';

export interface CommandResult {
  output: string;
  exitCode: number;
}

export class CliError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode: number) {
    super(message);
    this.name = 'CliError';
    this.exitCode = exitCode;
  }
}

export const exitCodeForResults = (results: PlatformResult[]): number =>
  results.every((r) => r.ok) ? 0 : 1;
