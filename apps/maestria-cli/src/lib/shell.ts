import { Data, Effect } from 'effect';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** Resolve the OS cache directory, respecting XDG_CACHE_HOME on Linux/macOS. */
export function getCacheDir(): string {
  const xdg = process.env.XDG_CACHE_HOME?.trim();
  if (xdg !== undefined && xdg !== null && xdg !== '') {
    return xdg;
  }
  return join(homedir(), '.cache');
}

/** Maestria's own cache directory (e.g. ~/.cache/maestria or $XDG_CACHE_HOME/maestria). */
export function getMaestriaCacheDir(): string {
  return join(getCacheDir(), 'maestria');
}

export function getVersionCacheFile(): string {
  return join(getMaestriaCacheDir(), 'versions.json');
}

// ── Errors ───────────────────────────────────────────
export class CommandError extends Data.TaggedError('CommandError')<{
  readonly command: string;
  readonly message: string;
}> {}

// ── Shell helpers ────────────────────────────────────

/**
 * Run a command with an optional working directory. `cwd` is the directory the
 * child process is launched in; callers that must isolate a command from the
 * invoking directory (e.g. Prime's cwd-scoped package commands) pass an empty
 * temporary directory. Existing callers that pass no `cwd` keep spawning in the
 * invoking process's directory.
 */
export function run(
  cmd: string,
  args: string[],
  timeoutMs = 30_000,
  cwd?: string,
): Effect.Effect<string, CommandError> {
  return Effect.tryPromise({
    catch: (error) => {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: narrow from unknown/union via runtime check, safe type assertion
      const err = error as Error & { stderr?: string; code?: number; signal?: string };
      const stderr = err.stderr?.trim() ?? '';
      const message = stderr || err.message;
      return new CommandError({
        command: `${cmd} ${args.join(' ')}`,
        message,
      });
    },
    try: async () => {
      const { execFile } = await import('node:child_process');
      const { promisify } = await import('node:util');
      const execFileAsync = promisify(execFile);
      const { stdout } = await execFileAsync(cmd, args, { cwd, timeout: timeoutMs });
      return stdout.trim();
    },
  });
}

export function readTextFile(filePath: string): Effect.Effect<string, CommandError> {
  return Effect.tryPromise({
    catch: (error) =>
      new CommandError({
        command: `read ${filePath}`,
        message: String(error),
      }),
    try: async () => {
      const { readFile } = await import('node:fs/promises');
      return await readFile(filePath, 'utf-8');
    },
  });
}

export function fileExists(filePath: string): Effect.Effect<boolean> {
  return Effect.tryPromise({
    catch: () => false,
    try: async () => {
      const { access } = await import('node:fs/promises');
      await access(filePath);
      return true;
    },
  }).pipe(Effect.catchCause(() => Effect.succeed(false)));
}

export function commandExists(cmd: string): Effect.Effect<boolean> {
  return run('which', [cmd]).pipe(
    Effect.map((out: string) => out.length > 0),
    Effect.catchCause(() => Effect.succeed(false)),
  );
}

export function npmViewVersion(pkg: string): Effect.Effect<string> {
  const readCache = (): Effect.Effect<string> =>
    readTextFile(getVersionCacheFile()).pipe(
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

  const updateCache = (version: string): Effect.Effect<void> =>
    Effect.tryPromise({
      catch: () => {
        /* empty */
      },
      try: async () => {
        const { mkdir, readFile, writeFile } = await import('node:fs/promises');
        await mkdir(getMaestriaCacheDir(), { recursive: true });
        let cache: Record<string, { version: string }> = {};
        try {
          const existing = await readFile(getVersionCacheFile(), 'utf-8');
          cache = JSON.parse(existing);
        } catch {
          /* file doesn't exist or is invalid */
        }
        cache[pkg] = { version };
        await writeFile(getVersionCacheFile(), JSON.stringify(cache));
      },
    }).pipe(Effect.catchCause(() => Effect.void));

  return Effect.gen(function* () {
    const version = yield* run('npm', ['view', pkg, 'version'], 5000).pipe(
      Effect.catchCause(() => Effect.succeed('')),
    );

    if (version) {
      yield* updateCache(version).pipe(Effect.catchCause(() => Effect.void));
      return version;
    }

    // Network failed - fall back to cached version (any age)
    return yield* readCache().pipe(Effect.catchCause(() => Effect.succeed('')));
  });
}

/** Invalidate the version cache for a package (called after successful update) */
export function invalidateVersionCache(pkg: string): Effect.Effect<void> {
  return Effect.gen(function* () {
    yield* readTextFile(getVersionCacheFile()).pipe(
      Effect.flatMap((out) => {
        try {
          const cache = JSON.parse(out);
          delete cache[pkg];
          return Effect.tryPromise({
            catch: () => {
              /* empty */
            },
            try: async () => {
              const { writeFile } = await import('node:fs/promises');
              await writeFile(getVersionCacheFile(), JSON.stringify(cache));
            },
          });
        } catch {
          return Effect.void;
        }
      }),
      Effect.catchCause(() => Effect.void),
    );
  });
}
