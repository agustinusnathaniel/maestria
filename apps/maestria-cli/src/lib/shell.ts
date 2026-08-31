import { Data, Effect } from 'effect';
import { homedir } from 'node:os';
import path from 'node:path';

/** Resolve the OS cache directory, respecting XDG_CACHE_HOME on Linux/macOS. */
export const getCacheDir = (): string => {
  const xdg = process.env.XDG_CACHE_HOME?.trim();
  if (xdg !== undefined && xdg !== null && xdg !== '') {
    return xdg;
  }
  return path.join(homedir(), '.cache');
};

/** Maestria's own cache directory (e.g. ~/.cache/maestria or $XDG_CACHE_HOME/maestria). */
export const getMaestriaCacheDir = (): string => path.join(getCacheDir(), 'maestria');

export const getVersionCacheFile = (): string => path.join(getMaestriaCacheDir(), 'versions.json');

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
export const run = (
  cmd: string,
  args: string[],
  timeoutMs = 30_000,
  cwd?: string,
): Effect.Effect<string, CommandError> =>
  Effect.tryPromise({
    catch: (error) => {
      const stderr =
        typeof error === 'object' &&
        error !== null &&
        'stderr' in error &&
        typeof error.stderr === 'string'
          ? error.stderr.trim()
          : '';
      const message = stderr || (error instanceof Error ? error.message : String(error));
      return new CommandError({
        command: `${cmd} ${args.join(' ')}`,
        message,
      });
    },
    try: async () => {
      const { execFile } = await import('node:child_process');
      const stdout = await Effect.runPromise(
        Effect.callback<string, Error>((resume) => {
          execFile(cmd, args, { cwd, encoding: 'utf-8', timeout: timeoutMs }, (error, output) => {
            if (error) {
              resume(Effect.fail(error));
              return;
            }
            resume(Effect.succeed(output));
          });
        }),
      );
      return stdout.trim();
    },
  });

export const readTextFile = (filePath: string): Effect.Effect<string, CommandError> =>
  Effect.tryPromise({
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

export const fileExists = (filePath: string): Effect.Effect<boolean> =>
  Effect.tryPromise({
    catch: () => false,
    try: async () => {
      const { access } = await import('node:fs/promises');
      await access(filePath);
      return true;
    },
  }).pipe(Effect.catchCause(() => Effect.succeed(false)));

export const commandExists = (cmd: string): Effect.Effect<boolean> =>
  run('which', [cmd]).pipe(
    Effect.map((out: string) => out.length > 0),
    Effect.catchCause(() => Effect.succeed(false)),
  );

type VersionCache = Record<string, { version: string }>;
type JsonRecord = Record<string, unknown>;

const isJsonRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseVersionCache = (text: string): VersionCache => {
  try {
    const parsed: unknown = JSON.parse(text);
    if (!isJsonRecord(parsed)) {
      return {};
    }
    const cache: VersionCache = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (isJsonRecord(value) && typeof value.version === 'string') {
        cache[key] = { version: value.version };
      }
    }
    return cache;
  } catch {
    return {};
  }
};

export const npmViewVersion = (pkg: string): Effect.Effect<string> => {
  const readCache = (): Effect.Effect<string> =>
    readTextFile(getVersionCacheFile()).pipe(
      Effect.map((out) => {
        try {
          const cache = parseVersionCache(out);
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
          cache = parseVersionCache(existing);
        } catch {
          /* file doesn't exist or is invalid */
        }
        cache[pkg] = { version };
        await writeFile(getVersionCacheFile(), JSON.stringify(cache));
      },
    }).pipe(Effect.catchCause(() => Effect.void));

  return Effect.gen(function* npmViewVersionEffect() {
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
};

/** Invalidate the version cache for a package (called after successful update) */
export const invalidateVersionCache = (pkg: string): Effect.Effect<void> =>
  Effect.gen(function* invalidateVersionCacheEffect() {
    yield* readTextFile(getVersionCacheFile()).pipe(
      Effect.flatMap((out) => {
        try {
          const parsed: unknown = JSON.parse(out);
          if (!isJsonRecord(parsed)) {
            return Effect.void;
          }
          const cache = Object.fromEntries(Object.entries(parsed).filter(([key]) => key !== pkg));
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
