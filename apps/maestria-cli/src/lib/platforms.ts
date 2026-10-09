// oxlint-disable max-lines -- platforms.ts is a cohesive registry aggregating 8 platform handlers (opencode, pi, kimi-code, hermes, cursor, claude-code, codex, omp) with shared helpers. Splitting the registry would fragment the single source for PLATFORM_IDS and platform lookup, harming discoverability and increasing cross-file churn for handler registration. The file's handlers share helpers (installNpmTarball, marketplace, the pi/omp factory) and are rarely edited together; file length is justified by cohesion.
import { Effect } from 'effect';
import { homedir, tmpdir } from 'node:os';
import nodePath from 'node:path';

import { parseAgentFrontmatterModel, setAgentFrontmatterModel } from '@/lib/agent-frontmatter.js';
import { installCodexManagedAgents, removeCodexManagedAgents } from '@/lib/codex-managed-agents.js';
import { cursorCliName } from '@/lib/cursor-cli.js';
import { MAESTRIA_PLUGIN_PACKAGE } from '@/lib/package-constants.js';
import {
  kimiCodeHome,
  kimiInstalledPath,
  kimiManagedPluginDir,
  readKimiInstalled,
  registerKimiPlugin,
  removeKimiPlugin,
} from '@/lib/kimi.js';
import { MAESTRIA_AGENTS } from '@/lib/model-config.js';
import { isFileNotFound, isRecord, parseJsonRecord, parseJsonValue } from '@/lib/primitives.js';
import type { JsonRecord } from '@/lib/primitives.js';
import {
  CommandError,
  commandExists,
  fileExists,
  getCacheDir,
  getMaestriaCacheDir,
  invalidateVersionCache,
  npmViewVersion,
  readTextFile,
  run,
} from '@/lib/shell.js';
import type { PlatformResult } from '@/types.js';

const { join } = nodePath;

// ── Shared helpers ───────────────────────────────────

/** Read OpenCode config file, trying .jsonc first then .json. */
const readOpenCodeConfig = (): Effect.Effect<string, CommandError> => {
  const jsoncPath = `${homedir()}/.config/opencode/opencode.jsonc`;
  const jsonPath = `${homedir()}/.config/opencode/opencode.json`;
  return readTextFile(jsoncPath).pipe(
    Effect.catchTag('CommandError', () => readTextFile(jsonPath)),
  );
};

/** Pack and extract a package in a private staging directory. */
const installNpmTarball = (
  pkg: string,
  dest: string,
  opts: { tag?: string } = {},
): Effect.Effect<void, CommandError> =>
  Effect.acquireUseRelease(
    Effect.tryPromise({
      catch: (error) =>
        new CommandError({ command: 'create npm pack directory', message: String(error) }),
      try: async () => {
        const { mkdtemp } = await import('node:fs/promises');
        return await mkdtemp(join(tmpdir(), 'maestria-'));
      },
    }),
    (stagingDir) =>
      Effect.gen(function* installNpmTarballEffect() {
        const pkgAtTag = `${pkg}@${opts.tag ?? 'latest'}`;
        yield* run('npm', ['pack', pkgAtTag, '--pack-destination', stagingDir], 120_000);
        const archive = yield* Effect.tryPromise({
          catch: (error) =>
            new CommandError({ command: `find tarball for ${pkgAtTag}`, message: String(error) }),
          try: async () => {
            const { readdir } = await import('node:fs/promises');
            const entries = await readdir(stagingDir);
            const matches = entries.filter((entry) => entry.endsWith('.tgz'));
            const [filename] = matches;
            if (matches.length !== 1 || filename === undefined) {
              throw new Error(`expected one packed archive, found ${matches.length}`);
            }
            return join(stagingDir, filename);
          },
        });
        yield* Effect.tryPromise({
          catch: (error) =>
            new CommandError({ command: `replace ${dest}`, message: String(error) }),
          try: async () => {
            const { mkdir, rm } = await import('node:fs/promises');
            await rm(dest, { force: true, recursive: true });
            await mkdir(dest, { recursive: true });
          },
        });
        yield* run('tar', ['-xzf', archive, '-C', dest, '--strip-components=1'], 120_000);
      }),
    (stagingDir) =>
      Effect.tryPromise({
        catch: (error) =>
          new CommandError({
            command: `remove npm pack directory ${stagingDir}`,
            message: String(error),
          }),
        try: async () => {
          const { rm } = await import('node:fs/promises');
          await rm(stagingDir, { force: true, recursive: true });
        },
      }),
  );

/**
 * Version string from a parsed JSON manifest. Missing, malformed, and
 * non-string versions all resolve to 'unknown', so handlers cannot drift into
 * different fallbacks for the same manifest.
 */
const manifestVersion = (manifest: JsonRecord | undefined): string =>
  typeof manifest?.version === 'string' ? manifest.version : 'unknown';

/**
 * Read a JSON manifest (typically package.json) and return its `version` field
 * via Node's cross-platform fs/promises API rather than a POSIX `cat`, so
 * installed paths in either host-native or Windows format work on the matching
 * host. Fails with a CommandError; callers decide whether a failed read means
 * 'unknown' (all current callers catch into 'unknown').
 */
export const readPackageJsonVersion = (
  packageJsonPath: string,
): Effect.Effect<string, CommandError> =>
  Effect.tryPromise({
    catch: (error) =>
      new CommandError({
        command: `read ${packageJsonPath}`,
        message: String(error),
      }),
    try: async () => {
      const { readFile } = await import('node:fs/promises');
      return manifestVersion(parseJsonRecord(await readFile(packageJsonPath, 'utf-8')));
    },
  });

const CLAUDE_MARKETPLACE_DIR = join(getMaestriaCacheDir(), 'claude-code-marketplace');
const CODEX_MARKETPLACE_DIR = join(getMaestriaCacheDir(), 'codex-marketplace');
const MAESTRIA_MARKETPLACE = 'maestria';
const MAESTRIA_PLUGIN = 'maestria';

const recordString = (record: JsonRecord, key: string): string => {
  const value = record[key];
  return typeof value === 'string' ? value : '';
};

const jsonRecords = (output: string, key?: string): JsonRecord[] => {
  const parsed = parseJsonValue(output);
  let value: unknown = parsed;
  if (key !== undefined && key !== '' && isRecord(parsed)) {
    value = parsed[key];
  }
  return Array.isArray(value) ? value.filter(isRecord) : [];
};

const hasMarketplace = (output: string): boolean =>
  jsonRecords(output, 'marketplaces').some(
    (marketplace) => marketplace.name === MAESTRIA_MARKETPLACE,
  );

const isMaestriaPlugin = (plugin: JsonRecord): boolean => {
  const pluginId = recordString(plugin, 'pluginId') || recordString(plugin, 'id');
  return (
    pluginId === `${MAESTRIA_PLUGIN}@${MAESTRIA_MARKETPLACE}` ||
    (recordString(plugin, 'name') === MAESTRIA_PLUGIN &&
      recordString(plugin, 'marketplaceName') === MAESTRIA_MARKETPLACE)
  );
};

const hasMaestriaPlugin = (output: string): boolean =>
  jsonRecords(output, 'installed').some(isMaestriaPlugin);

const installedMaestriaVersion = (output: string): string =>
  manifestVersion(jsonRecords(output, 'installed').find(isMaestriaPlugin));

const hostPluginList = (command: 'claude' | 'codex'): Effect.Effect<string, CommandError> =>
  Effect.suspend(() => run(command, ['plugin', 'list', '--json']));

const hostPluginVersion = (command: 'claude' | 'codex'): Effect.Effect<string, CommandError> =>
  hostPluginList(command).pipe(
    Effect.map(installedMaestriaVersion),
    Effect.catchEager(() => Effect.succeed('unknown')),
  );

const hostPluginInstalled = (command: 'claude' | 'codex'): Effect.Effect<boolean> =>
  hostPluginList(command).pipe(
    Effect.map(hasMaestriaPlugin),
    Effect.catchEager(() => Effect.succeed(false)),
  );

/** Marketplace data a host CLI needs to prepare its local plugin marketplace. */
interface NpmMarketplace {
  readonly command: 'claude' | 'codex';
  readonly dir: string;
  readonly file: string;
  readonly manifest: JsonRecord;
  readonly packageName: string;
}

/** Register the marketplace directory with the host CLI when it is absent. */
const ensureMarketplace = (
  command: 'claude' | 'codex',
  dir: string,
): Effect.Effect<void, CommandError> =>
  run(command, ['plugin', 'marketplace', 'list', '--json']).pipe(
    Effect.flatMap((output) =>
      hasMarketplace(output)
        ? Effect.void
        : run(command, ['plugin', 'marketplace', 'add', dir]).pipe(Effect.asVoid),
    ),
  );

const prepareNpmMarketplace = (marketplace: NpmMarketplace): Effect.Effect<void, CommandError> => {
  const pluginDir = `${marketplace.dir}/plugins/${MAESTRIA_PLUGIN}`;
  const marketplacePath = `${marketplace.dir}/${marketplace.file}`;

  return Effect.gen(function* prepareNpmMarketplaceEffect() {
    yield* installNpmTarball(marketplace.packageName, pluginDir);
    yield* Effect.tryPromise({
      catch: (error) =>
        new CommandError({
          command: `write ${marketplacePath}`,
          message: String(error),
        }),
      try: async () => {
        const { mkdir, writeFile } = await import('node:fs/promises');
        await mkdir(nodePath.dirname(marketplacePath), { recursive: true });
        await writeFile(marketplacePath, `${JSON.stringify(marketplace.manifest, null, 2)}\n`);
      },
    });
    yield* ensureMarketplace(marketplace.command, marketplace.dir);
  });
};

const claudeMarketplace: NpmMarketplace = {
  command: 'claude',
  dir: CLAUDE_MARKETPLACE_DIR,
  file: '.claude-plugin/marketplace.json',
  manifest: {
    $schema: 'https://anthropic.com/claude-code/marketplace.schema.json',
    name: MAESTRIA_MARKETPLACE,
    owner: {
      name: 'Agustinus Nathaniel',
      url: 'https://github.com/agustinusnathaniel',
    },
    plugins: [
      {
        displayName: 'maestria',
        name: MAESTRIA_PLUGIN,
        source: './plugins/maestria',
      },
    ],
  },
  packageName: MAESTRIA_PLUGIN_PACKAGE,
};

const codexMarketplace: NpmMarketplace = {
  command: 'codex',
  dir: CODEX_MARKETPLACE_DIR,
  file: '.agents/plugins/marketplace.json',
  manifest: {
    interface: { displayName: 'maestria' },
    name: MAESTRIA_MARKETPLACE,
    plugins: [
      {
        category: 'Developer Tools',
        name: MAESTRIA_PLUGIN,
        policy: { authentication: 'ON_USE', installation: 'AVAILABLE' },
        source: { path: './plugins/maestria', source: 'local' },
      },
    ],
  },
  packageName: MAESTRIA_PLUGIN_PACKAGE,
};

const refreshClaudeMarketplace = (): Effect.Effect<void, CommandError> =>
  // Network refresh shared by install and update; same 120s fetch deadline.
  run('claude', ['plugin', 'marketplace', 'update', MAESTRIA_MARKETPLACE], 120_000).pipe(
    Effect.asVoid,
  );

// Install and update share one flow: stage the marketplace payload, refresh
// it, then materialize through the host CLI. Host fetches keep the 120s
// deadline instead of the shared 30s default.
const runClaudePlugin = (action: 'install' | 'update'): Effect.Effect<void, CommandError> =>
  Effect.gen(function* runClaudePluginEffect() {
    yield* prepareNpmMarketplace(claudeMarketplace);
    yield* refreshClaudeMarketplace();
    yield* run(
      'claude',
      ['plugin', action, `${MAESTRIA_PLUGIN}@${MAESTRIA_MARKETPLACE}`, '--scope', 'user'],
      120_000,
    );
  });

// ── Platform ID literal registry ─────────────────────

/**
 * Literal-typed registry of platform IDs. This is the single source for the
 * platform ID union - PlatformHandler.id and ValidPlatform both derive from it,
 * so adding or removing a platform updates the type without an independent cast.
 */
export const PLATFORM_IDS = [
  'opencode',
  'omp',
  'pi',
  'kimi-code',
  'hermes',
  'cursor',
  'claude-code',
  'codex',
] as const;

export type PlatformId = (typeof PLATFORM_IDS)[number];

// ── Platform definitions ─────────────────────────────

/**
 * Per-update host state that a handler captures exactly once so the update
 * command's version check, preflight, and update step can share a single host
 * inspection instead of running it once per step. Handlers that need no shared
 * state omit `captureUpdateSnapshot`.
 */
export interface PlatformUpdateSnapshot {
  /** Installed version observed when the snapshot was captured. */
  readonly installedVersion: string;
}

export interface PlatformHandler {
  readonly id: PlatformId;
  readonly label: string;
  readonly npmPackage?: string;
  readonly detect: Effect.Effect<boolean>;
  readonly isInstalled: Effect.Effect<boolean>;
  readonly getInstalledVersion: Effect.Effect<string, CommandError>;
  readonly getLatestVersion: Effect.Effect<string>;
  /** Whether `update --version` can select an exact package version. */
  readonly supportsVersionPinning?: boolean;
  /**
   * Optional single-capture per-update snapshot. When present, the update
   * command captures it once and uses it for the installed-version check, the
   * preflight, and the update itself, so a stateful host inspection runs a
   * single time per update. A capture failure fails the update with the
   * accurate error rather than updating blind.
   */
  readonly captureUpdateSnapshot?: Effect.Effect<PlatformUpdateSnapshot, CommandError>;
  /**
   * Optional update eligibility/preflight check, run by the update command
   * before the version-equality "Already up to date" short-circuit so an
   * ineligible registration can never be reported as a successful no-op. It
   * receives the per-update snapshot when the handler captured one. Fails with
   * a CommandError to block the update with an accurate message. Handlers
   * without such a condition omit it.
   */
  readonly preflightUpdate?: (
    snapshot?: PlatformUpdateSnapshot,
  ) => Effect.Effect<void, CommandError>;
  readonly install: Effect.Effect<void, CommandError>;
  readonly update: (
    version?: string,
    snapshot?: PlatformUpdateSnapshot,
  ) => Effect.Effect<void, CommandError>;
  readonly uninstall: Effect.Effect<void, CommandError>;
}

/**
 * Handler definition accepted by the registry. A handler that declares an
 * `npmPackage` derives `getLatestVersion` from it, so the npm package and the
 * latest-version lookup cannot drift apart. Platforms distributed outside npm
 * (Hermes is git-based) keep an explicit `getLatestVersion` override.
 */
type PlatformDefinition = Omit<PlatformHandler, 'getLatestVersion'> & {
  readonly getLatestVersion?: Effect.Effect<string>;
};

const resolveLatestVersion = (definition: PlatformDefinition): PlatformHandler => {
  if (definition.getLatestVersion !== undefined) {
    return { ...definition, getLatestVersion: definition.getLatestVersion };
  }
  if (definition.npmPackage === undefined || definition.npmPackage === '') {
    throw new Error(`Platform '${definition.id}' must declare npmPackage or getLatestVersion`);
  }
  return { ...definition, getLatestVersion: npmViewVersion(definition.npmPackage) };
};

const clearOpencodeCache = (): Effect.Effect<void, CommandError> =>
  Effect.tryPromise({
    catch: (error) =>
      new CommandError({
        command: `clear opencode cache ${join(getCacheDir(), 'opencode', 'packages', '@maestria', 'opencode*')}`,
        message: String(error),
      }),
    try: async () => {
      const { readdir, rm } = await import('node:fs/promises');
      const base = join(getCacheDir(), 'opencode', 'packages', '@maestria');
      let entries: string[];
      try {
        entries = await readdir(base);
      } catch (error) {
        if (isFileNotFound(error)) {
          return;
        }
        throw error;
      }
      const stale = entries.filter((e) => e.startsWith('opencode'));
      await Promise.all(
        stale.map(async (e) => {
          await rm(`${base}/${e}`, { force: true, recursive: true });
        }),
      );
    },
  });

const opencode: PlatformDefinition = {
  detect: commandExists('opencode'),
  getInstalledVersion: readOpenCodeConfig().pipe(
    Effect.map((config) => {
      const match = /@maestria\/opencode@(?<version>.+?)"/u.exec(config);
      return match?.groups?.version ?? null;
    }),
    Effect.flatMap((specifier) => {
      if (specifier === null || specifier === undefined || specifier === '') {
        return Effect.succeed('unknown');
      }
      return readPackageJsonVersion(
        join(
          getCacheDir(),
          'opencode',
          'packages',
          `@maestria/opencode@${specifier}`,
          'node_modules',
          '@maestria',
          'opencode',
          'package.json',
        ),
      );
    }),
    Effect.catchEager(() => Effect.succeed('unknown')),
  ),
  id: 'opencode',
  install: Effect.gen(function* install() {
    yield* clearOpencodeCache();
    // Install globally by default - install is a setup command, not per-project
    yield* run('opencode', ['plugin', '@maestria/opencode@latest', '-g'], 120_000);
  }).pipe(Effect.asVoid),
  isInstalled: readOpenCodeConfig().pipe(
    Effect.map((out) => out.includes('@maestria/opencode')),
    Effect.catchEager(() => Effect.succeed(false)),
  ),
  label: 'OpenCode',
  npmPackage: '@maestria/opencode',
  uninstall: Effect.sync(() => {
    console.log(
      `\n  To uninstall OpenCode:\n` +
        `  1. Edit ~/.config/opencode/opencode.jsonc (or .opencode/opencode.jsonc in your project)\n` +
        `  2. Remove "@maestria/opencode@latest" from the "plugin" array\n` +
        `  3. Optionally clear cache: rm -rf ${join(getCacheDir(), 'opencode', 'packages', '@maestria', 'opencode*')}\n`,
    );
  }),
  update: (version?: string) =>
    Effect.gen(function* update() {
      const tag = version ?? 'latest';

      yield* clearOpencodeCache();

      // Check if installed globally or at project level
      const globalConfig = yield* readOpenCodeConfig().pipe(
        Effect.map((out) => out.includes('@maestria/opencode')),
        Effect.catchEager(() => Effect.succeed(false)),
      );
      const flag = globalConfig ? ['-g', '--force'] : ['--force'];
      // Cold fetches outlast the 30s default; match install's 120s deadline.
      yield* run('opencode', ['plugin', `@maestria/opencode@${tag}`, ...flag], 120_000);
    }),
};

const claudeCode: PlatformDefinition = {
  detect: commandExists('claude'),
  getInstalledVersion: hostPluginVersion('claude'),
  id: 'claude-code',
  install: runClaudePlugin('install'),
  isInstalled: hostPluginInstalled('claude'),
  label: 'Claude Code',
  npmPackage: MAESTRIA_PLUGIN_PACKAGE,
  supportsVersionPinning: false,
  uninstall: Effect.suspend(() =>
    run('claude', [
      'plugin',
      'uninstall',
      `${MAESTRIA_PLUGIN}@${MAESTRIA_MARKETPLACE}`,
      '--scope',
      'user',
      '--yes',
    ]),
  ).pipe(Effect.asVoid),
  update: () => runClaudePlugin('update'),
};

// Codex plugin add/remove share one shape: host call with the marketplace
// reference. Host fetches keep the 120s deadline instead of the 30s default.
const runCodexPlugin = (action: 'add' | 'remove'): Effect.Effect<void, CommandError> =>
  run(
    'codex',
    ['plugin', action, `${MAESTRIA_PLUGIN}@${MAESTRIA_MARKETPLACE}`, '--json'],
    120_000,
  ).pipe(Effect.asVoid);

const codex: PlatformDefinition = {
  detect: commandExists('codex'),
  getInstalledVersion: hostPluginVersion('codex'),
  id: 'codex',
  install: Effect.gen(function* install() {
    yield* prepareNpmMarketplace(codexMarketplace);
    yield* runCodexPlugin('add');
    yield* installCodexManagedAgents(`${CODEX_MARKETPLACE_DIR}/plugins/${MAESTRIA_PLUGIN}`);
  }).pipe(Effect.asVoid),
  isInstalled: hostPluginInstalled('codex'),
  label: 'Codex CLI',
  npmPackage: MAESTRIA_PLUGIN_PACKAGE,
  supportsVersionPinning: false,
  uninstall: Effect.gen(function* uninstall() {
    yield* run('codex', [
      'plugin',
      'remove',
      `${MAESTRIA_PLUGIN}@${MAESTRIA_MARKETPLACE}`,
      '--json',
    ]);
    yield* removeCodexManagedAgents();
  }).pipe(Effect.asVoid),
  update: (_version?: string) =>
    Effect.gen(function* update() {
      yield* prepareNpmMarketplace(codexMarketplace);
      // Codex CLI has no plugin update command. Reinstalling after refreshing
      // the marketplace is its supported update path.
      yield* runCodexPlugin('remove');
      yield* runCodexPlugin('add');
      yield* installCodexManagedAgents(`${CODEX_MARKETPLACE_DIR}/plugins/${MAESTRIA_PLUGIN}`);
    }),
};

/**
 * Pi and its fork omp share one handler shape: detect the binary, read the
 * installed version from the host's package.json, check installation by that
 * same file, and drive install/update/uninstall through the host's package
 * installer. Only command spelling, reference prefix, install path, label, and
 * Pi's subagent prerequisite differ, so they are parameters here.
 */
interface PiStylePlatformDefinition {
  readonly id: 'pi' | 'omp';
  readonly label: string;
  /** Host CLI binary and package command name. */
  readonly binary: string;
  readonly npmPackage: string;
  /** Package reference prefix the host installer requires (`npm:` for Pi). */
  readonly referencePrefix: string;
  /** Plugin command group (`['plugin']` for omp; empty for Pi). */
  readonly commandPrefix: readonly string[];
  /** package.json whose `version` reports the installed maestria package. */
  readonly installedPackageJsonPath: string;
  /** Peer dependency installed before every install/update; failures are ignored. */
  readonly prerequisite?: Effect.Effect<void>;
}

const piStylePlatform = (definition: PiStylePlatformDefinition): PlatformDefinition => {
  const packageReference = `${definition.referencePrefix}${definition.npmPackage}`;
  const taggedReference = (version: string): string => `${packageReference}@${version}`;
  const pluginArgs = (action: 'install' | 'uninstall', reference: string): string[] => [
    ...definition.commandPrefix,
    action,
    reference,
  ];

  return {
    detect: commandExists(definition.binary),
    getInstalledVersion: readPackageJsonVersion(definition.installedPackageJsonPath).pipe(
      Effect.catchEager(() => Effect.succeed('unknown')),
    ),
    id: definition.id,
    install: Effect.gen(function* install() {
      if (definition.prerequisite !== undefined) {
        yield* definition.prerequisite;
      }
      yield* run(definition.binary, pluginArgs('install', packageReference), 120_000);
    }).pipe(Effect.asVoid),
    isInstalled: fileExists(definition.installedPackageJsonPath),
    label: definition.label,
    npmPackage: definition.npmPackage,
    uninstall: run(definition.binary, pluginArgs('uninstall', packageReference)).pipe(
      Effect.asVoid,
    ),
    update: (version?: string) =>
      Effect.gen(function* update() {
        if (definition.prerequisite !== undefined) {
          yield* definition.prerequisite;
        }
        const tagged =
          version !== null && version !== undefined && version !== ''
            ? taggedReference(version)
            : taggedReference('latest');
        yield* run(definition.binary, pluginArgs('install', tagged), 120_000);
      }),
  };
};

/**
 * Range for the Pi subagent dispatch peer. Kept in step with the
 * '@gotgenes/pi-subagents' catalog entry in pnpm-workspace.yaml, which
 * `@maestria/pi` declares as its peer. Bare latest would install a version the
 * peer range can reject; Pi accepts a semver range after the `npm:` prefix and
 * reconciles updates inside it (`parseNpmSpec` + `validRange` in the host's
 * package manager).
 */
const PI_SUBAGENTS_RANGE = '^21.5.1';

/**
 * Pi's subagent dispatch needs @gotgenes/pi-subagents. It is installed before
 * every install/update; a failure is ignored so a missing peer dependency
 * cannot block the main package install.
 */
const piSubagentsPrerequisite: Effect.Effect<void> = run(
  'pi',
  ['install', `npm:@gotgenes/pi-subagents@${PI_SUBAGENTS_RANGE}`],
  60_000,
).pipe(Effect.catchEager(() => Effect.void));

const pi: PlatformDefinition = piStylePlatform({
  binary: 'pi',
  commandPrefix: [],
  id: 'pi',
  installedPackageJsonPath: `${homedir()}/.pi/agent/npm/node_modules/@maestria/pi/package.json`,
  label: 'Pi',
  npmPackage: '@maestria/pi',
  prerequisite: piSubagentsPrerequisite,
  referencePrefix: 'npm:',
});

/**
 * Replace a platform's installed plugin payload while preserving the host
 * state around it. `capture` reads the pre-replacement state (a failure aborts
 * before anything is destroyed), `replace` installs the new payload, and
 * `restore` reapplies the captured state to the fresh payload.
 * `invalidatePackage` clears the npm version cache after a successful update,
 * which only the update paths need.
 *
 * Capture and replace are thunks so call sites resolve environment-dependent
 * paths when the operation runs, not when the handler is defined.
 */
interface ReplacePlatformPayloadOptions<State> {
  readonly capture: () => Effect.Effect<State, CommandError>;
  readonly replace: () => Effect.Effect<void, CommandError>;
  readonly restore: (state: State) => Effect.Effect<void, CommandError>;
  readonly invalidatePackage?: string;
}

const replacePlatformPayload = <State>(
  options: ReplacePlatformPayloadOptions<State>,
): Effect.Effect<void, CommandError> =>
  Effect.gen(function* replacePlatformPayloadEffect() {
    const state = yield* options.capture();
    yield* options.replace();
    yield* options.restore(state);
    if (options.invalidatePackage !== undefined && options.invalidatePackage !== '') {
      yield* invalidateVersionCache(options.invalidatePackage);
    }
  });

const kimiCode: PlatformDefinition = {
  detect: Effect.gen(function* detect() {
    if (yield* commandExists('kimi')) {
      return true;
    }
    const hasRegistry = yield* fileExists(kimiInstalledPath());
    if (hasRegistry) {
      return true;
    }
    return yield* fileExists(`${kimiCodeHome()}/config.toml`);
  }),
  getInstalledVersion: Effect.suspend(() =>
    readPackageJsonVersion(`${kimiManagedPluginDir()}/kimi.plugin.json`).pipe(
      Effect.catchEager(() => Effect.succeed('unknown')),
    ),
  ),
  id: 'kimi-code',
  install: replacePlatformPayload({
    // Validate the host registry before the tarball helper replaces the managed
    // directory. Kimi's plugin manager treats malformed installed.json as a
    // load failure, so do not destroy the current copy before surfacing it.
    capture: readKimiInstalled,
    replace: () => installNpmTarball(MAESTRIA_PLUGIN_PACKAGE, kimiManagedPluginDir()),
    restore: registerKimiPlugin,
  }),
  isInstalled: readKimiInstalled().pipe(
    Effect.map((file) => file.plugins.some((plugin) => plugin.id === MAESTRIA_PLUGIN)),
    Effect.flatMap((installed) =>
      installed ? Effect.succeed(true) : fileExists(`${kimiManagedPluginDir()}/kimi.plugin.json`),
    ),
    Effect.catchEager(() => Effect.succeed(false)),
  ),
  label: 'Kimi Code',
  npmPackage: MAESTRIA_PLUGIN_PACKAGE,
  uninstall: removeKimiPlugin().pipe(Effect.asVoid),
  update: (version?: string) =>
    replacePlatformPayload({
      capture: readKimiInstalled,
      invalidatePackage: MAESTRIA_PLUGIN_PACKAGE,
      replace: () =>
        installNpmTarball(MAESTRIA_PLUGIN_PACKAGE, kimiManagedPluginDir(), {
          tag: version ?? 'latest',
        }),
      restore: registerKimiPlugin,
    }),
};

const hermes: PlatformDefinition = {
  detect: commandExists('hermes'),
  getInstalledVersion: readPackageJsonVersion(
    `${homedir()}/.hermes/plugins/maestria/plugin.json`,
  ).pipe(Effect.catchEager(() => Effect.succeed('unknown'))),
  id: 'hermes',
  install: Effect.gen(function* install() {
    yield* run(
      'hermes',
      ['plugins', 'install', 'agustinusnathaniel/maestria/packages/plugin', '--enable'],
      120_000,
    );
    const legacy = yield* fileExists(`${homedir()}/.hermes/plugins/maestria-hermes/plugin.yaml`);
    if (legacy) {
      yield* run('hermes', ['plugins', 'disable', 'maestria-hermes'], 15_000);
    }
  }).pipe(Effect.asVoid),
  isInstalled: fileExists(`${homedir()}/.hermes/plugins/maestria/plugin.json`),
  label: 'Hermes',
  npmPackage: MAESTRIA_PLUGIN_PACKAGE,
  supportsVersionPinning: false,
  uninstall: Effect.suspend(() => run('hermes', ['plugins', 'remove', 'maestria'], 15_000)).pipe(
    Effect.asVoid,
  ),
  update: () =>
    Effect.gen(function* update() {
      const portable = yield* fileExists(`${homedir()}/.hermes/plugins/maestria/plugin.json`);
      if (!portable) {
        yield* hermes.install;
        return;
      }
      yield* run('hermes', ['plugins', 'update', 'maestria'], 120_000);
    }).pipe(Effect.asVoid),
};

const CURSOR_PLUGIN_DIR = `${homedir()}/.cursor/plugins/local/maestria`;
const CURSOR_PLUGIN_JSON = `${CURSOR_PLUGIN_DIR}/.cursor-plugin/plugin.json`;
const CURSOR_AGENT_DIR = `${CURSOR_PLUGIN_DIR}/agents/cursor`;
export const CURSOR_AGENT_NAMES = MAESTRIA_AGENTS;

/** Capture configured Cursor plugin-agent models before a package update replaces the plugin. */
const readCursorAgentModels = (): Effect.Effect<Record<string, string>, CommandError> =>
  Effect.tryPromise({
    catch: (error) =>
      new CommandError({
        command: `read Cursor agent models from ${CURSOR_AGENT_DIR}`,
        message: String(error),
      }),
    try: async () => {
      const { readFile } = await import('node:fs/promises');
      const entries = await Promise.all(
        CURSOR_AGENT_NAMES.map(async (agent) => {
          try {
            const content = await readFile(`${CURSOR_AGENT_DIR}/${agent}.md`, 'utf-8').catch(
              async (error: unknown) => {
                if (!isFileNotFound(error)) {
                  throw error;
                }
                return await readFile(`${CURSOR_PLUGIN_DIR}/agents/${agent}.md`, 'utf-8');
              },
            );
            const model = parseAgentFrontmatterModel(content, { unquote: true });
            return model === undefined || model === '' ? null : ([agent, model] as const);
          } catch (error) {
            if (isFileNotFound(error)) {
              return null;
            }
            throw error;
          }
        }),
      );
      return Object.fromEntries(entries.filter((entry) => entry !== null));
    },
  });

/** Reapply configured Cursor plugin-agent models after replacing the generated package files. */
const restoreCursorAgentModels = (
  models: Record<string, string>,
): Effect.Effect<void, CommandError> =>
  Effect.tryPromise({
    catch: (error) =>
      new CommandError({
        command: `restore Cursor agent models in ${CURSOR_AGENT_DIR}`,
        message: String(error),
      }),
    try: async () => {
      const { mkdir, readFile, writeFile } = await import('node:fs/promises');
      const agentDir = CURSOR_AGENT_DIR;
      await mkdir(agentDir, { recursive: true });
      await Promise.all(
        Object.entries(models).map(async ([agent, model]) => {
          const filePath = `${agentDir}/${agent}.md`;
          const content = await readFile(filePath, 'utf-8');
          await writeFile(
            filePath,
            setAgentFrontmatterModel(content, model, { preserveDelimiters: true }),
            'utf-8',
          );
        }),
      );
    },
  });

/**
 * Cursor's local plugin directory lives under `~/.cursor/plugins/local`; make
 * sure the parent exists before the tarball is extracted into it.
 */
const ensureCursorPluginParentDirectory = (): Effect.Effect<void, CommandError> =>
  Effect.tryPromise({
    catch: (error) =>
      new CommandError({
        command: `mkdir -p ${homedir()}/.cursor/plugins/local`,
        message: String(error),
      }),
    try: async () => {
      const { mkdir } = await import('node:fs/promises');
      await mkdir(`${homedir()}/.cursor/plugins/local`, { recursive: true });
    },
  });

const cursor: PlatformDefinition = {
  detect: Effect.gen(function* detect() {
    const cliName = yield* cursorCliName();
    if (cliName !== null && cliName !== undefined && cliName !== '') {
      return true;
    }
    // An unrelated `agent` binary (for example another vendor's CLI) must not
    // be rescued by the broad ~/.cursor directory fallback.
    if (yield* commandExists('agent')) {
      return false;
    }
    return yield* fileExists(`${homedir()}/.cursor`);
  }),
  getInstalledVersion: readPackageJsonVersion(`${CURSOR_PLUGIN_DIR}/package.json`).pipe(
    Effect.catchEager(() => Effect.succeed('unknown')),
  ),
  id: 'cursor',
  install: replacePlatformPayload({
    capture: readCursorAgentModels,
    replace: () =>
      ensureCursorPluginParentDirectory().pipe(
        Effect.flatMap(() => installNpmTarball(MAESTRIA_PLUGIN_PACKAGE, CURSOR_PLUGIN_DIR)),
      ),
    restore: restoreCursorAgentModels,
  }),
  isInstalled: fileExists(CURSOR_PLUGIN_JSON),
  label: 'Cursor',
  npmPackage: MAESTRIA_PLUGIN_PACKAGE,
  uninstall: Effect.gen(function* uninstall() {
    yield* Effect.tryPromise({
      catch: (e) =>
        new CommandError({ command: `rm -rf ${CURSOR_PLUGIN_DIR}`, message: String(e) }),
      try: async () => {
        await import('node:fs/promises').then(async (m) => {
          await m.rm(CURSOR_PLUGIN_DIR, { force: true, recursive: true });
        });
      },
    });
  }).pipe(Effect.asVoid),
  update: (version?: string) =>
    replacePlatformPayload({
      capture: readCursorAgentModels,
      invalidatePackage: MAESTRIA_PLUGIN_PACKAGE,
      replace: () =>
        installNpmTarball(MAESTRIA_PLUGIN_PACKAGE, CURSOR_PLUGIN_DIR, { tag: version ?? 'latest' }),
      restore: restoreCursorAgentModels,
    }),
};

// OMP consumes the consolidated portable plugin: `omp plugin install`
// stages `@maestria/plugin`, whose root manifest and shared skills OMP loads
// natively (see packages/plugin/integrations/omp/README.md). No
// maestria-owned executable ships for OMP: no session hooks, no tool
// interception, and no per-agent model files, so OMP has no model-config
// handler. The retired `@maestria/omp` payload is not removed automatically;
// uninstall it first when migrating (`omp plugin uninstall @maestria/omp`).
const omp: PlatformDefinition = piStylePlatform({
  binary: 'omp',
  commandPrefix: ['plugin'],
  id: 'omp',
  installedPackageJsonPath: `${homedir()}/.omp/plugins/node_modules/@maestria/plugin/package.json`,
  label: 'Oh My Pi',
  npmPackage: MAESTRIA_PLUGIN_PACKAGE,
  referencePrefix: '',
});

// ── Registry ─────────────────────────────────────────
export const platforms: readonly PlatformHandler[] = [
  opencode,
  pi,
  kimiCode,
  hermes,
  cursor,
  omp,
  claudeCode,
  codex,
].map(resolveLatestVersion);

export const getPlatform = (id: string): PlatformHandler | undefined =>
  platforms.find((p) => p.id === id);

export const getPlatformOrResult = (
  id: string,
  fallbackLabel?: string,
): PlatformHandler | PlatformResult =>
  getPlatform(id) ?? {
    id,
    label: fallbackLabel ?? id,
    message: 'Platform definition not found. This is a bug.',
    ok: false,
  };
