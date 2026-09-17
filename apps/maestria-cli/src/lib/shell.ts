import { Data, Effect } from 'effect';
import { homedir } from 'node:os';
import path from 'node:path';

import { isRecord } from '@/lib/primitives.js';

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

const MAX_FAILURE_DETAIL = 1000;

const readFailureField = (error: unknown, field: string): string => {
  if (typeof error !== 'object' || error === null) {
    return '';
  }
  const value: unknown = Reflect.get(error, field);
  return typeof value === 'string' ? value.trim() : '';
};

/**
 * Actionable message from an execFile rejection. Child output arrives as
 * separate callback arguments, so the caller attaches it to the rejection;
 * without that, failures (notably timeout kills, which carry no stderr)
 * degrade to a bare "Command failed: <cmd>".
 */
const describeRunFailure = (timeoutMs: number, error: unknown): string => {
  const stderr = readFailureField(error, 'stderr');
  const stdout = readFailureField(error, 'stdout');
  const detail = (stderr === '' ? stdout : stderr).slice(0, MAX_FAILURE_DETAIL);
  const suffix = detail === '' ? '' : `: ${detail}`;
  if (typeof error === 'object' && error !== null) {
    const record = error as { code?: unknown; killed?: unknown; signal?: unknown };
    if (record.killed === true) {
      const signal = typeof record.signal === 'string' ? record.signal : 'SIGTERM';
      return `Command timed out after ${timeoutMs}ms (${signal})${suffix}`;
    }
    if (typeof record.code === 'number') {
      return `Command failed with exit code ${record.code}${suffix}`;
    }
  }
  const fallback = error instanceof Error ? error.message : String(error);
  return suffix === '' ? fallback : `${fallback}${suffix}`;
};

/**
 * Run a command with an optional working directory. `cwd` is the directory the
 * child process is launched in; callers that must isolate a command from the
 * invoking directory (e.g. Prime's cwd-scoped package commands) pass an empty
 * temporary directory. Existing callers that pass no `cwd` keep spawning in the
 * invoking process's directory.
 *
 * Callers driving network-bound host installers pass an explicit timeout.
 */
export const run = (
  cmd: string,
  args: string[],
  timeoutMs = 30_000,
  cwd?: string,
): Effect.Effect<string, CommandError> =>
  Effect.tryPromise({
    catch: (error) =>
      new CommandError({
        command: `${cmd} ${args.join(' ')}`,
        message: describeRunFailure(timeoutMs, error),
      }),
    try: async () => {
      const { execFile } = await import('node:child_process');
      const stdout = await Effect.runPromise(
        Effect.callback<string, Error>((resume) => {
          execFile(
            cmd,
            args,
            { cwd, encoding: 'utf-8', timeout: timeoutMs },
            (error, output, stderr) => {
              if (error) {
                resume(Effect.fail(Object.assign(error, { stderr, stdout: output })));
                return;
              }
              resume(Effect.succeed(output));
            },
          );
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
  Effect.tryPromise(async () => {
    const { access } = await import('node:fs/promises');
    await access(filePath);
    return true;
  }).pipe(Effect.catchCause(() => Effect.succeed(false)));

export const commandExists = (cmd: string): Effect.Effect<boolean> =>
  run('which', [cmd]).pipe(
    Effect.map((out: string) => out.length > 0),
    Effect.catchCause(() => Effect.succeed(false)),
  );

type VersionCache = Record<string, { version: string }>;

const parseVersionCache = (text: string): VersionCache => {
  try {
    const parsed: unknown = JSON.parse(text);
    if (!isRecord(parsed)) {
      return {};
    }
    const cache: VersionCache = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (isRecord(value) && typeof value.version === 'string') {
        cache[key] = { version: value.version };
      }
    }
    return cache;
  } catch {
    return {};
  }
};

/** Read the cached package versions, tolerating a missing or invalid file. */
const cachedVersions = (): Effect.Effect<VersionCache> =>
  readTextFile(getVersionCacheFile()).pipe(
    Effect.map(parseVersionCache),
    Effect.catchCause(() => Effect.succeed({})),
  );

export const npmViewVersion = (pkg: string): Effect.Effect<string> => {
  const updateCache = (version: string): Effect.Effect<void> =>
    cachedVersions().pipe(
      Effect.flatMap((cache) =>
        Effect.tryPromise({
          catch: () => {
            /* empty */
          },
          try: async () => {
            const { mkdir, writeFile } = await import('node:fs/promises');
            await mkdir(getMaestriaCacheDir(), { recursive: true });
            await writeFile(
              getVersionCacheFile(),
              JSON.stringify({ ...cache, [pkg]: { version } }),
            );
          },
        }),
      ),
      Effect.catchCause(() => Effect.void),
    );

  return Effect.gen(function* npmViewVersionEffect() {
    const version = yield* run('npm', ['view', pkg, 'version'], 5000).pipe(
      Effect.catchCause(() => Effect.succeed('')),
    );

    if (version) {
      yield* updateCache(version).pipe(Effect.catchCause(() => Effect.void));
      return version;
    }

    // Network failed - fall back to cached version (any age)
    return yield* cachedVersions().pipe(Effect.map((cache) => cache[pkg]?.version ?? ''));
  });
};

/** Invalidate the version cache for a package (called after successful update) */
export const invalidateVersionCache = (pkg: string): Effect.Effect<void> =>
  readTextFile(getVersionCacheFile()).pipe(
    Effect.flatMap((out) =>
      Effect.tryPromise({
        catch: () => {
          /* empty */
        },
        try: async () => {
          const parsed: unknown = JSON.parse(out);
          if (!isRecord(parsed)) {
            return;
          }
          const { [pkg]: _removed, ...rest } = parsed;
          const { writeFile } = await import('node:fs/promises');
          await writeFile(getVersionCacheFile(), JSON.stringify(rest));
        },
      }),
    ),
    Effect.catchCause(() => Effect.void),
  );
