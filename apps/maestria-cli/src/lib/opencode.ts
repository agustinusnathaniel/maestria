import { Effect, Schedule } from 'effect';
import type { Duration } from 'effect';
import { applyEdits, modify, parse } from 'jsonc-parser/lib/esm/main.js';
import { homedir } from 'node:os';
import path from 'node:path';

import { isRecord } from '@/lib/primitives.js';
import { CommandError, fileExists, getCacheDir, readTextFile, run } from '@/lib/shell.js';

export const OPENCODE_PACKAGE = '@maestria/opencode';

/** The oldest OpenCode release whose plugin API `@maestria/opencode` targets. */
const MIN_OPENCODE_VERSION = [2, 0, 28] as const;

/** The last `@maestria/opencode` release that OpenCode V1 can load. */
export const OPENCODE_V1_LAST_VERSION = '0.8.0';

const JSONC_OPTIONS = { formattingOptions: { insertSpaces: true, tabSize: 2 } } as const;

// OpenCode V2 reads the global config from the same location as V1 and honors XDG_CONFIG_HOME.
export const openCodeConfigDir = (): string => {
  const xdg = process.env.XDG_CONFIG_HOME?.trim();
  return path.join(
    xdg !== undefined && xdg !== '' ? xdg : path.join(homedir(), '.config'),
    'opencode',
  );
};

const configPath = (): Effect.Effect<string> => {
  const jsonc = path.join(openCodeConfigDir(), 'opencode.jsonc');
  const json = path.join(openCodeConfigDir(), 'opencode.json');
  return fileExists(jsonc).pipe(
    Effect.flatMap((hasJsonc) =>
      hasJsonc ? Effect.succeed(jsonc) : fileExists(json).pipe(Effect.map(() => json)),
    ),
  );
};

const readConfig = (): Effect.Effect<{ path: string; text: string }> =>
  configPath().pipe(
    Effect.flatMap((file) =>
      readTextFile(file).pipe(
        Effect.catchEager(() => Effect.succeed('')),
        Effect.map((text) => ({ path: file, text })),
      ),
    ),
  );

export interface PluginEntry {
  readonly index: number;
  readonly spec: string;
  readonly options?: unknown;
}

/** V2 entries are strings or `{ package, options }`; V1 entries are strings or `[spec, options]`. */
const entrySpec = (entry: unknown): string | undefined => {
  if (typeof entry === 'string') {
    return entry;
  }
  if (Array.isArray(entry) && typeof entry[0] === 'string') {
    return entry[0];
  }
  return isRecord(entry) && typeof entry.package === 'string' ? entry.package : undefined;
};

const packageName = (spec: string): string => {
  const versionAt = spec.indexOf('@', 1);
  return versionAt === -1 ? spec : spec.slice(0, versionAt);
};

const uniqueSpecs = (entries: readonly PluginEntry[]): string[] => [
  ...new Set(entries.map((entry) => entry.spec)),
];

/** maestria entries in V2 `plugins` or the V1 `plugin` array V2 ignores. */
export const maestriaEntries = (text: string, key: 'plugin' | 'plugins'): PluginEntry[] => {
  const config: unknown = parse(text);
  const list: unknown = isRecord(config) ? config[key] : undefined;
  if (!Array.isArray(list)) {
    return [];
  }
  return list.flatMap((entry: unknown, index) => {
    const spec = entrySpec(entry);
    if (spec === undefined || packageName(spec) !== OPENCODE_PACKAGE) {
      return [];
    }
    return [{ index, options: isRecord(entry) ? entry.options : undefined, spec }];
  });
};

/** Drops V1 `plugin` entries so OpenCode V1 cannot load a V2-only release. */
export const removeLegacyEntries = (text: string): string => {
  const legacy = new Set(maestriaEntries(text, 'plugin').map((entry) => entry.index));
  if (legacy.size === 0) {
    return text;
  }
  const config: unknown = parse(text);
  const list: unknown[] = isRecord(config) && Array.isArray(config.plugin) ? config.plugin : [];
  // Rewritten whole: jsonc-parser corrupts the text when removing consecutive trailing elements.
  const kept = list.filter((_entry, index) => !legacy.has(index));
  return applyEdits(text, modify(text, ['plugin'], kept, JSONC_OPTIONS));
};

/** Turns the configured `spec` string entry into `{ package, options }`. */
export const withOptions = (text: string, spec: string, options?: unknown): string => {
  const entry = maestriaEntries(text, 'plugins').find((candidate) => candidate.spec === spec);
  if (entry === undefined || options === undefined) {
    return text;
  }
  const edits = modify(text, ['plugins', entry.index], { options, package: spec }, JSONC_OPTIONS);
  return applyEdits(text, edits);
};

const writeConfig = (file: string, text: string): Effect.Effect<void, CommandError> =>
  Effect.tryPromise({
    catch: (error) => new CommandError({ command: `write ${file}`, message: String(error) }),
    try: async () => {
      const { writeFile } = await import('node:fs/promises');
      await writeFile(file, text, 'utf-8');
    },
  });

const editConfig = (edit: (text: string) => string): Effect.Effect<void, CommandError> =>
  Effect.gen(function* editConfigEffect() {
    const config = yield* readConfig();
    const next = edit(config.text);
    if (next !== config.text) {
      yield* writeConfig(config.path, next);
    }
  });

const plugin = (args: string[]): Effect.Effect<void, CommandError> =>
  // Package fetches keep the 120s host deadline.
  run('opencode', ['plugin', ...args], 120_000).pipe(Effect.asVoid);

/**
 * OpenCode loads package plugins per working directory in the background, so `plugin update`
 * from a directory it has not loaded yet reports the configured package as not configured.
 */
const updateInPlace = (
  target: string,
  retryDelay: Duration.Input,
): Effect.Effect<void, CommandError> =>
  plugin(['update', target]).pipe(
    Effect.retry({
      schedule: Schedule.spaced(retryDelay),
      times: 29,
      while: (failure) => failure.message.includes('Plugin is not configured'),
    }),
  );

export const requireOpenCodeV2: Effect.Effect<void, CommandError> = Effect.suspend(() =>
  run('opencode', ['--version']),
).pipe(
  Effect.flatMap((output) => {
    const found = /(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)/u.exec(output)?.groups ?? {};
    const version = [found.major, found.minor, found.patch].map(Number);
    const order = version.findIndex((part, index) => part !== MIN_OPENCODE_VERSION[index]);
    const supported = order === -1 || (version[order] ?? 0) > (MIN_OPENCODE_VERSION[order] ?? 0);
    return supported
      ? Effect.void
      : Effect.fail(
          new CommandError({
            command: 'opencode --version',
            message: `${OPENCODE_PACKAGE} requires OpenCode ${MIN_OPENCODE_VERSION.join('.')} or later (found ${output.trim() || 'an unknown version'}). Upgrade OpenCode, or on OpenCode V1 keep ${OPENCODE_PACKAGE}@${OPENCODE_V1_LAST_VERSION} in the "plugin" array.`,
          }),
        );
  }),
);

export const isOpenCodeInstalled: Effect.Effect<boolean> = Effect.suspend(readConfig).pipe(
  Effect.map(
    ({ text }) =>
      maestriaEntries(text, 'plugins').length > 0 || maestriaEntries(text, 'plugin').length > 0,
  ),
);

/** Reads the newest cached package for the configured spec; V1-only entries report `unknown`. */
export const openCodeInstalledVersion: Effect.Effect<string> = Effect.suspend(readConfig).pipe(
  Effect.flatMap(({ text }) => {
    const [entry] = maestriaEntries(text, 'plugins');
    if (entry === undefined) {
      return Effect.succeed('unknown');
    }
    const cacheKey = entry.spec === OPENCODE_PACKAGE ? `${entry.spec}@latest` : entry.spec;
    return Effect.tryPromise(async () => {
      const { readdir, readFile } = await import('node:fs/promises');
      const base = path.join(getCacheDir(), 'opencode', 'npm', cacheKey);
      const installs = await readdir(base);
      const [newest] = installs.toSorted((a, b) => Number(b) - Number(a));
      const manifest: unknown = JSON.parse(
        await readFile(
          path.join(base, newest ?? '', 'node_modules', OPENCODE_PACKAGE, 'package.json'),
          'utf-8',
        ),
      );
      return isRecord(manifest) && typeof manifest.version === 'string'
        ? manifest.version
        : 'unknown';
    });
  }),
  Effect.catchEager(() => Effect.succeed('unknown')),
);

/**
 * Adds `target` before removing other maestria specs, so a failed fetch leaves the old entry in
 * place. `plugin add` ignores an already-configured spec, and options move to the new entry.
 */
const replaceEntries = (
  entries: readonly PluginEntry[],
  target: string,
): Effect.Effect<void, CommandError> =>
  Effect.gen(function* replaceEntriesEffect() {
    const specs = uniqueSpecs(entries);
    if (!specs.includes(target)) {
      yield* plugin(['add', target]);
      const options = entries.find((entry) => entry.options !== undefined)?.options;
      yield* editConfig((text) => withOptions(text, target, options));
    }
    for (const spec of specs.filter((candidate) => candidate !== target)) {
      yield* plugin(['remove', spec]);
    }
  });

const currentEntries = (): Effect.Effect<PluginEntry[], CommandError> =>
  Effect.gen(function* currentEntriesEffect() {
    yield* requireOpenCodeV2;
    yield* editConfig(removeLegacyEntries);
    return maestriaEntries((yield* readConfig()).text, 'plugins');
  });

export const installOpenCode: Effect.Effect<void, CommandError> = Effect.gen(
  function* installOpenCodeEffect() {
    const entries = yield* currentEntries();
    if (entries.length === 0) {
      yield* replaceEntries(entries, OPENCODE_PACKAGE);
    }
  },
);

/** `plugin update` refreshes a lone unpinned entry in place; any other change replaces entries. */
export const updateOpenCode = (
  version?: string,
  retryDelay: Duration.Input = '2 seconds',
): Effect.Effect<void, CommandError> =>
  Effect.gen(function* updateOpenCodeEffect() {
    const entries = yield* currentEntries();
    const target = version === undefined ? OPENCODE_PACKAGE : `${OPENCODE_PACKAGE}@${version}`;
    const specs = uniqueSpecs(entries);
    if (version === undefined && specs.length === 1 && specs[0] === target) {
      yield* updateInPlace(target, retryDelay);
      return;
    }
    yield* replaceEntries(entries, target);
  });

export const uninstallOpenCode: Effect.Effect<void, CommandError> = Effect.gen(
  function* uninstallOpenCodeEffect() {
    for (const spec of uniqueSpecs(maestriaEntries((yield* readConfig()).text, 'plugins'))) {
      yield* plugin(['remove', spec]);
    }
    yield* editConfig(removeLegacyEntries);
  },
);
