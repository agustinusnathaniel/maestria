import { Effect, Data } from 'effect';
import { homedir } from 'os';

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
    catch: (error) => {
      const err = error as Error & { stderr?: string; code?: number; signal?: string };
      const stderr = err.stderr?.trim() ?? '';
      const message = stderr || err.message;
      return new CommandError({
        command: `${cmd} ${args.join(' ')}`,
        message,
      });
    },
  });
}

/** Run a command through a shell (supports globs, pipes, redirects) */
export function sh(command: string, timeoutMs = 30_000): Effect.Effect<string, CommandError> {
  return run('sh', ['-c', command], timeoutMs);
}

export function commandExists(cmd: string): Effect.Effect<boolean, never> {
  return run('which', [cmd]).pipe(
    Effect.map((out: string) => out.length > 0),
    Effect.catchCause(() => Effect.succeed(false)),
  );
}

export function npmViewVersion(pkg: string): Effect.Effect<string, never> {
  const cacheDir = `${homedir()}/.cache/maestria`;
  const cacheFile = `${cacheDir}/versions.json`;

  const readCache = (): Effect.Effect<string, never> =>
    run('cat', [cacheFile], 2_000).pipe(
      Effect.map((out) => {
        try {
          const cache: Record<string, { version: string }> = JSON.parse(out);
          return cache[pkg]?.version ?? '';
        } catch {
          return '';
        }
      }),
      Effect.catchCause(() => Effect.succeed('')),
    );

  const updateCache = (version: string, cachedAt: number): Effect.Effect<void, never> =>
    Effect.tryPromise({
      try: async () => {
        const { mkdir, readFile, writeFile } = await import('node:fs/promises');
        await mkdir(cacheDir, { recursive: true });
        let cache: Record<string, { version: string; cachedAt: number }> = {};
        try {
          const existing = await readFile(cacheFile, 'utf-8');
          cache = JSON.parse(existing);
        } catch {
          /* file doesn't exist or is invalid */
        }
        cache[pkg] = { version, cachedAt }; // cachedAt written for backward compat with old readers
        await writeFile(cacheFile, JSON.stringify(cache));
      },
      catch: () => {},
    }).pipe(Effect.catchCause(() => Effect.void));

  return Effect.gen(function* () {
    const now = Date.now();
    const version = yield* run('npm', ['view', pkg, 'version'], 5_000).pipe(
      Effect.catchCause(() => Effect.succeed('')),
    );

    if (version) {
      yield* updateCache(version, now).pipe(Effect.catchCause(() => Effect.void));
      return version;
    }

    // Network failed — fall back to cached version (any age)
    return yield* readCache().pipe(Effect.catchCause(() => Effect.succeed('')));
  });
}

/** Invalidate the version cache for a package (called after successful update) */
export function invalidateVersionCache(pkg: string): Effect.Effect<void, never> {
  const cacheDir = `${homedir()}/.cache/maestria`;
  const cacheFile = `${cacheDir}/versions.json`;

  return Effect.gen(function* () {
    yield* run('cat', [cacheFile], 2_000).pipe(
      Effect.flatMap((out) => {
        try {
          const cache = JSON.parse(out);
          delete cache[pkg];
          return Effect.tryPromise({
            try: async () => {
              const { writeFile } = await import('node:fs/promises');
              await writeFile(cacheFile, JSON.stringify(cache));
            },
            catch: () => {},
          });
        } catch {
          return Effect.void;
        }
      }),
      Effect.catchCause(() => Effect.void),
    );
  });
}
