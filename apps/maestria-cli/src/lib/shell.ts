import { execFile } from 'node:child_process';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { Data, Effect } from 'effect';
import { homedir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { isRecord, parseJsonRecord } from '@/lib/primitives.js';

// oxlint-disable-next-line strict-void-return -- Node provides a custom promisifier for execFile; its ChildProcess return is intentionally unused.
const execFileAsync = promisify(execFile);

/** OS cache directory, respecting XDG_CACHE_HOME when set. */
export const getCacheDir = (): string => {
  const xdg = process.env.XDG_CACHE_HOME?.trim();
  if (xdg !== undefined && xdg !== '') {
    return xdg;
  }
  return path.join(homedir(), '.cache');
};

/** Maestria cache directory (e.g. ~/.cache/maestria). */
export const getMaestriaCacheDir = (): string => path.join(getCacheDir(), 'maestria');

/** User-preference directory (survives cache clears, unlike the cache directory). */
export const getMaestriaConfigDir = (): string => {
  const xdg = process.env.XDG_CONFIG_HOME?.trim();
  const base = xdg !== undefined && xdg !== '' ? xdg : path.join(homedir(), '.config');
  return path.join(base, 'maestria');
};

export const getVersionCacheFile = (): string => path.join(getMaestriaCacheDir(), 'versions.json');

export class CommandError extends Data.TaggedError('CommandError')<{
  readonly command: string;
  readonly message: string;
}> {}

const MAX_FAILURE_DETAIL = 1000;

const readFailureField = (error: unknown, field: string): string => {
  if (typeof error !== 'object' || error === null) {
    return '';
  }
  const value: unknown = Reflect.get(error, field);
  return typeof value === 'string' ? value.trim() : '';
};

/**
 * Actionable message from an execFile rejection. Timeout kills carry no
 * stderr, so attached child output is used when present.
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
 * Run a command with an optional working directory. Callers isolating a
 * command (e.g. Prime's cwd-scoped package commands) pass an empty temp dir;
 * callers driving host installers pass an explicit timeout.
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
    try: async (signal) => {
      const { stdout } = await execFileAsync(cmd, args, {
        cwd,
        encoding: 'utf-8',
        signal,
        timeout: timeoutMs,
      });
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
    try: async () => await readFile(filePath, 'utf-8'),
  });

export const fileExists = (filePath: string): Effect.Effect<boolean> =>
  Effect.tryPromise(async () => {
    await access(filePath);
    return true;
  }).pipe(Effect.catchEager(() => Effect.succeed(false)));

export const commandExists = (cmd: string): Effect.Effect<boolean> =>
  run('which', [cmd]).pipe(
    Effect.map((out: string) => out.length > 0),
    Effect.catchEager(() => Effect.succeed(false)),
  );

type VersionCache = Record<string, { version: string }>;

const parseVersionCache = (text: string): VersionCache => {
  const cache: VersionCache = {};
  for (const [key, value] of Object.entries(parseJsonRecord(text) ?? {})) {
    if (isRecord(value) && typeof value.version === 'string') {
      cache[key] = { version: value.version };
    }
  }
  return cache;
};

/** Read cached package versions, tolerating a missing or invalid file. */
const cachedVersions = (): Effect.Effect<VersionCache> =>
  readTextFile(getVersionCacheFile()).pipe(
    Effect.map(parseVersionCache),
    Effect.catchEager(() => Effect.succeed({})),
  );

export const npmViewVersion = (pkg: string): Effect.Effect<string> =>
  Effect.gen(function* npmViewVersionEffect() {
    const version = yield* run('npm', ['view', pkg, 'version'], 5000).pipe(
      Effect.catchEager(() => Effect.succeed('')),
    );

    const cache = yield* cachedVersions();
    if (version) {
      yield* Effect.tryPromise(async () => {
        await mkdir(getMaestriaCacheDir(), { recursive: true });
        await writeFile(getVersionCacheFile(), JSON.stringify({ ...cache, [pkg]: { version } }));
      }).pipe(Effect.catchEager(() => Effect.void));
    }
    return version || (cache[pkg]?.version ?? '');
  });

/** Invalidate the version cache for a package after a successful update. */
export const invalidateVersionCache = (pkg: string): Effect.Effect<void> =>
  readTextFile(getVersionCacheFile()).pipe(
    Effect.flatMap((out) =>
      Effect.tryPromise(async () => {
        const parsed: unknown = JSON.parse(out);
        if (!isRecord(parsed)) {
          return;
        }
        const { [pkg]: _removed, ...rest } = parsed;
        await writeFile(getVersionCacheFile(), JSON.stringify(rest));
      }),
    ),
    Effect.catchEager(() => Effect.void),
  );
