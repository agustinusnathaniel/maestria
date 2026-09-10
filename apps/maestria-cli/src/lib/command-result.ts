/** Result a command handler returns for the CLI boundary to print and exit with. */
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
