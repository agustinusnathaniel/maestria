import { Effect, Data } from 'effect';

// ── Errors ───────────────────────────────────────────
export class CommandError extends Data.TaggedError('CommandError')<{
  readonly command: string;
  readonly message: string;
}> {}

// ── Shell helpers ────────────────────────────────────

export function run(
  cmd: string,
  args: string[],
  timeoutMs = 30_000,
): Effect.Effect<string, CommandError> {
  return Effect.tryPromise({
    try: async () => {
      const { execFile } = await import('node:child_process');
      const { promisify } = await import('node:util');
      const execFileAsync = promisify(execFile);
      const { stdout } = await execFileAsync(cmd, args, { timeout: timeoutMs });
      return stdout.trim();
    },
    catch: (error) =>
      new CommandError({
        command: `${cmd} ${args.join(' ')}`,
        message: error instanceof Error ? error.message : String(error),
      }),
  });
}

export function commandExists(cmd: string): Effect.Effect<boolean, never> {
  return run('which', [cmd]).pipe(
    Effect.map((out: string) => out.length > 0),
    Effect.catchCause(() => Effect.succeed(false)),
  );
}

export function npmViewVersion(pkg: string): Effect.Effect<string, CommandError> {
  return run('npm', ['view', pkg, 'version']);
}
