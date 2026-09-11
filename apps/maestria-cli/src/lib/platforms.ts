// oxlint-disable max-lines -- platforms.ts is a cohesive registry aggregating 9 platform handlers (opencode, pi, prime-agent, kimi-code, hermes, cursor, claude-code, codex, omp) with shared helpers. Splitting the registry would fragment the single source for PLATFORM_IDS and platform lookup, harming discoverability and increasing cross-file churn for handler registration. The file's handlers share helpers (installNpmTarball, marketplace, the pi/omp factory) and are rarely edited together; file length is justified by cohesion.
import { Effect } from 'effect';
import { homedir, tmpdir } from 'node:os';
import nodePath from 'node:path';
import picocolors from 'picocolors';

import { parseAgentFrontmatterModel, setAgentFrontmatterModel } from '@/lib/agent-frontmatter.js';
import { installCodexManagedAgents, removeCodexManagedAgents } from '@/lib/codex-managed-agents.js';
import { cursorCliName } from '@/lib/cursor-cli.js';
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

const { isAbsolute, join, win32 } = nodePath;

// ── Shared helpers ───────────────────────────────────

/** Read OpenCode config file, trying .jsonc first then .json. */
const readOpenCodeConfig = (): Effect.Effect<string, CommandError> => {
  const jsoncPath = `${homedir()}/.config/opencode/opencode.jsonc`;
  const jsonPath = `${homedir()}/.config/opencode/opencode.json`;
  return readTextFile(jsoncPath).pipe(Effect.catchCause(() => readTextFile(jsonPath)));
};

/**
 * Install a package from an npm tarball into a destination directory.
 *
 * Shared by the kimi-code and cursor platform handlers, which both pack
 * Maestria-scoped packages to /tmp and extract them into their platform's
 * plugin directory. The tarball name derives from the package name with
 * the @maestria/ scope stripped (e.g. @maestria/kimi-code ->
 * maestria-kimi-code-*.tgz).
 *
 * @param pkg    Full npm package name (e.g. '@maestria/kimi-code')
 * @param dest   Destination directory to extract into
 * @param opts   Optional npm dist-tag (default 'latest')
 */
const cleanupStaleTarball = (
  tmpDir: string,
  prefix: string,
  dest: string,
): Effect.Effect<void, CommandError> =>
  Effect.tryPromise({
    catch: (error) =>
      new CommandError({
        command: `cleanup ${tmpDir}/${prefix}*.tgz and ${dest}`,
        message: String(error),
      }),
    try: async () => {
      const { readdir, unlink, rm } = await import('node:fs/promises');
      const entries = await readdir(tmpDir);
      const stale = entries.filter((e) => e.startsWith(prefix) && e.endsWith('.tgz'));
      await Promise.all(
        stale.map(async (e) => {
          await unlink(join(tmpDir, e));
        }),
      );
      await rm(dest, { force: true, recursive: true });
    },
  });

const findPackedTarball = (
  tmpDir: string,
  prefix: string,
  pkgAtTag: string,
): Effect.Effect<string, CommandError> =>
  Effect.tryPromise({
    catch: (error) =>
      new CommandError({
        command: `find tarball ${tmpDir}/${prefix}*.tgz`,
        message: String(error),
      }),
    try: async () => {
      const { readdir } = await import('node:fs/promises');
      const entries = await readdir(tmpDir);
      const matches = entries.filter((e) => e.startsWith(prefix) && e.endsWith('.tgz'));
      if (matches.length === 0) {
        throw new Error(`no tarball found for ${pkgAtTag} in ${tmpDir}`);
      }
      if (matches.length > 1) {
        throw new Error(`ambiguous tarballs for ${pkgAtTag} in ${tmpDir}: ${matches.join(', ')}`);
      }
      return join(tmpDir, matches[0]);
    },
  });

const installNpmTarball = (
  pkg: string,
  dest: string,
  opts: { tag?: string } = {},
): Effect.Effect<void, CommandError> => {
  const tag = opts.tag ?? 'latest';
  const shortName = pkg.replace('@maestria/', '');
  const prefix = `maestria-${shortName}-`;
  const pkgAtTag = `${pkg}@${tag}`;
  const tmpDir = tmpdir();
  return Effect.gen(function* installNpmTarballEffect() {
    yield* cleanupStaleTarball(tmpDir, prefix, dest);
    yield* run('npm', ['pack', pkgAtTag, '--pack-destination', tmpDir], 120_000);
    const tarballPath = yield* findPackedTarball(tmpDir, prefix, pkgAtTag);
    yield* Effect.tryPromise({
      catch: (error) => new CommandError({ command: `mkdir -p ${dest}`, message: String(error) }),
      try: async () => {
        const { mkdir } = await import('node:fs/promises');
        await mkdir(dest, { recursive: true });
      },
    });
    yield* run('tar', ['-xzf', tarballPath, '-C', dest, '--strip-components=1'], 120_000);
    yield* Effect.tryPromise({
      catch: (error) =>
        new CommandError({ command: `rm -f ${tarballPath}`, message: String(error) }),
      try: async () => {
        const { unlink } = await import('node:fs/promises');
        await unlink(tarballPath);
      },
    });
  });
};

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
    Effect.catchCause(() => Effect.succeed('unknown')),
  );

const hostPluginInstalled = (command: 'claude' | 'codex'): Effect.Effect<boolean> =>
  hostPluginList(command).pipe(
    Effect.map(hasMaestriaPlugin),
    Effect.catchCause(() => Effect.succeed(false)),
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
        displayName: 'Maestria',
        name: MAESTRIA_PLUGIN,
        source: './plugins/maestria',
      },
    ],
  },
  packageName: '@maestria/claude-code',
};

const codexMarketplace: NpmMarketplace = {
  command: 'codex',
  dir: CODEX_MARKETPLACE_DIR,
  file: '.agents/plugins/marketplace.json',
  manifest: {
    interface: { displayName: 'Maestria' },
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
  packageName: '@maestria/codex',
};

const refreshClaudeMarketplace = (): Effect.Effect<void, CommandError> =>
  run('claude', ['plugin', 'marketplace', 'update', MAESTRIA_MARKETPLACE]).pipe(Effect.asVoid);

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
  'prime-agent',
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
 * state (every handler except Prime Agent) omit `captureUpdateSnapshot`.
 */
export interface PlatformUpdateSnapshot {
  /** Installed version observed when the snapshot was captured. */
  readonly installedVersion: string;
  /**
   * Prime Agent: the version-pinned user-scope source registration (e.g.
   * `npm:@maestria/prime-agent@0.2.0`) when the registration is pinned. Prime
   * skips `package update` for pinned registrations, so the update flow fails
   * with an accurate error instead of claiming a successful update. Unset for
   * unpinned registrations.
   */
  readonly pinnedSource?: string;
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
   * preflight, and the update itself, so a stateful host inspection (e.g.
   * Prime's `package list`) runs a single time per update. A capture failure
   * fails the update with the accurate error rather than updating blind.
   */
  readonly captureUpdateSnapshot?: Effect.Effect<PlatformUpdateSnapshot, CommandError>;
  /**
   * Optional update eligibility/preflight check, run by the update command
   * before the version-equality "Already up to date" short-circuit so an
   * ineligible registration can never be reported as a successful no-op. It
   * receives the per-update snapshot when the handler captured one. Fails with
   * a CommandError to block the update with an accurate message (e.g. Prime's
   * version-pinned registration check, which Prime itself skips for
   * `package update`). Handlers without such a condition omit it.
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
    Effect.catchCause(() => Effect.succeed('unknown')),
  ),
  id: 'opencode',
  install: Effect.gen(function* install() {
    yield* clearOpencodeCache();
    // Install globally by default - install is a setup command, not per-project
    yield* run('opencode', ['plugin', '@maestria/opencode@latest', '-g'], 120_000);
  }).pipe(Effect.asVoid),
  isInstalled: readOpenCodeConfig().pipe(
    Effect.map((out) => out.includes('@maestria/opencode')),
    Effect.catchCause(() => Effect.succeed(false)),
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
        Effect.catchCause(() => Effect.succeed(false)),
      );
      const flag = globalConfig ? ['-g', '--force'] : ['--force'];
      yield* run('opencode', ['plugin', `@maestria/opencode@${tag}`, ...flag]);
    }),
};

const claudeCode: PlatformDefinition = {
  detect: commandExists('claude'),
  getInstalledVersion: hostPluginVersion('claude'),
  id: 'claude-code',
  install: Effect.gen(function* install() {
    yield* prepareNpmMarketplace(claudeMarketplace);
    yield* refreshClaudeMarketplace();
    yield* run('claude', [
      'plugin',
      'install',
      `${MAESTRIA_PLUGIN}@${MAESTRIA_MARKETPLACE}`,
      '--scope',
      'user',
    ]);
  }).pipe(Effect.asVoid),
  isInstalled: hostPluginInstalled('claude'),
  label: 'Claude Code',
  npmPackage: '@maestria/claude-code',
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
  update: (_version?: string) =>
    Effect.gen(function* update() {
      yield* prepareNpmMarketplace(claudeMarketplace);
      yield* refreshClaudeMarketplace();
      yield* run('claude', [
        'plugin',
        'update',
        `${MAESTRIA_PLUGIN}@${MAESTRIA_MARKETPLACE}`,
        '--scope',
        'user',
      ]);
    }),
};

const codex: PlatformDefinition = {
  detect: commandExists('codex'),
  getInstalledVersion: hostPluginVersion('codex'),
  id: 'codex',
  install: Effect.gen(function* install() {
    yield* prepareNpmMarketplace(codexMarketplace);
    yield* run('codex', ['plugin', 'add', `${MAESTRIA_PLUGIN}@${MAESTRIA_MARKETPLACE}`, '--json']);
    yield* installCodexManagedAgents(`${CODEX_MARKETPLACE_DIR}/plugins/${MAESTRIA_PLUGIN}`);
  }).pipe(Effect.asVoid),
  isInstalled: hostPluginInstalled('codex'),
  label: 'Codex CLI',
  npmPackage: '@maestria/codex',
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
      yield* run('codex', [
        'plugin',
        'remove',
        `${MAESTRIA_PLUGIN}@${MAESTRIA_MARKETPLACE}`,
        '--json',
      ]);
      yield* run('codex', [
        'plugin',
        'add',
        `${MAESTRIA_PLUGIN}@${MAESTRIA_MARKETPLACE}`,
        '--json',
      ]);
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
  /** package.json whose `version` reports the installed Maestria package. */
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
      Effect.catchCause(() => Effect.succeed('unknown')),
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
 * Pi's subagent dispatch needs @gotgenes/pi-subagents. It is installed before
 * every install/update; a failure is ignored so a missing peer dependency
 * cannot block the main package install.
 */
const piSubagentsPrerequisite: Effect.Effect<void> = run(
  'pi',
  ['install', 'npm:@gotgenes/pi-subagents'],
  60_000,
).pipe(Effect.catchCause(() => Effect.void));

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

// Prime Agent is Pi rebranded: the Prime fork of @earendil-works/pi-coding-agent
// (config dir `.prime/agent`, binary `prime-agent`). Packages are registered via
// `prime-agent package install/update/remove npm:@maestria/prime-agent`; by
// default (no --local flag) install/remove write to global settings
// (`~/.prime/agent/settings.json`). The CLI has no scope parameter, so this
// handler manages the documented global (user) scope only.
//
// Scope isolation: Prime's package commands resolve project settings from the
// current working directory (`package update` scans both user and project
// settings based on cwd), so every Prime command here runs from a freshly
// created empty temporary directory (see withPrimeTempCwd). From that isolated
// cwd only the user (global) scope is visible: a project's registrations are
// never scanned, counted, or modified, and Prime settings files are never
// edited directly. Temp-cwd creation fails closed with a CommandError and the
// directory is removed on both success and failure.
//
// Detection reads `prime-agent package list`, which prints configured package
// sources grouped by scope: a "User packages:" section (global settings) and a
// "Project packages:" section (project settings). Only the user section is
// managed here; project-only registrations must not count as installed because
// install/update/remove target the default global scope. Each entry is one
// source line (optionally suffixed with `(filtered)`) followed by its own
// indented installed-path line when the package is installed. The version is
// read from that entry's installed path package.json via Node's cross-platform
// fs/promises API (not a POSIX `cat`), so Windows-style installed paths resolve
// on Windows hosts.
//
// Updates: Prime's `package update <source>` accepts no version spec and
// versioned/pinned specs are skipped by updates, so exact version pinning is
// not exposed (supportsVersionPinning: false). A normal update captures the
// registration state once per update (captureUpdateSnapshot), reusing that
// single `package list` for the installed-version check, the preflight, and
// the update step; the preflight detects a version-pinned user registration
// before the update command's "Already up to date" short-circuit and reports
// an accurate error instead of claiming a successful update or invalidating
// the CLI version cache. The same per-update snapshot also means a user
// unpinned + project pinned mix updates only the user registration - the
// project pin is never consulted (only the user scope is parsed, and commands
// run from an isolated cwd where no project settings exist).
//
// Binary detection uses the shared commandExists helper, which probes via the
// POSIX `which` command. The repository has no cross-platform executable lookup
// abstraction, and every platform handler shares this helper, so Prime
// detection inherits that existing shared behavior; full Windows support for
// executable detection is not claimed here. Installed-path parsing and version
// reads above are cross-platform.
const PRIME_MAESTRIA_SOURCE = 'npm:@maestria/prime-agent';

/**
 * Match a configured `@maestria/prime-agent` npm source line as printed by
 * `prime-agent package list`, including the optional npm version/ref suffix
 * (e.g. `npm:@maestria/prime-agent@0.2.0`) and the optional `(filtered)`
 * marker. Prime installs npm packages by name, so a versioned source resolves
 * to the same installed path as the unversioned one.
 */
const PRIME_MAESTRIA_SOURCE_RE = /^\s*npm:@maestria\/prime-agent(?:@\S+)?(?:\s+\(filtered\))?\s*$/u;

/**
 * Match a version-pinned npm source registration, i.e. one with an explicit
 * version/ref suffix (e.g. `npm:@maestria/prime-agent@0.2.0`). Prime skips
 * `package update` for pinned registrations, so the CLI must not report a
 * successful update for them.
 */
const PRIME_MAESTRIA_PINNED_RE = /^npm:@maestria\/prime-agent@\S+(?:\s+\(filtered\))?$/u;

/**
 * ANSI SGR escape sequence matcher, used to strip bold/dim styling from
 * `prime-agent package list` section headers and installed-path lines. The
 * ESC byte is produced via String.fromCharCode so no control character is
 * embedded in the source (eslint no-control-regex).
 */
const ANSI_SGR_RE = new RegExp(`${String.fromCodePoint(27)}\\[[0-9;]*m`, 'gu');

/**
 * Extract the user (global) scope section of `prime-agent package list`
 * output. Prime prints a "User packages:" section followed by a "Project
 * packages:" section; only the user section is managed by this CLI. Section
 * headers are styled bold when printed to a TTY, so ANSI codes are stripped
 * before matching. Returns [] when no user section is present.
 */
const primeUserScopeLines = (output: string): string[] => {
  const lines = output.replace(ANSI_SGR_RE, '').split('\n');
  const start = lines.findIndex((line) => /^\s*user\s+packages:\s*$/iu.test(line));
  if (start === -1) {
    return [];
  }
  const end = lines.findIndex(
    (line, index) => index > start && /^\s*project\s+packages:\s*$/iu.test(line),
  );
  return lines.slice(start + 1, end === -1 ? undefined : end);
};

/** True when the user-scope section of `package list` contains our source. */
const hasPrimeMaestriaPackage = (output: string): boolean =>
  primeUserScopeLines(output).some((line) => PRIME_MAESTRIA_SOURCE_RE.test(line));

/**
 * Return the user-scope maestria source line when it is version-pinned (e.g.
 * `npm:@maestria/prime-agent@0.2.0`), or undefined when the registration is
 * unpinned or absent. Prime skips `package update` for pinned registrations,
 * so the update flow must fail with an accurate message instead of claiming an
 * update happened.
 */
const primeMaestriaPinnedSource = (output: string): string | undefined => {
  const source = primeUserScopeLines(output).find((line) => PRIME_MAESTRIA_SOURCE_RE.test(line));
  const trimmed = source?.trim();
  if (trimmed === undefined || trimmed === '' || !PRIME_MAESTRIA_PINNED_RE.test(trimmed)) {
    return undefined;
  }
  return trimmed;
};

/**
 * True when a path is absolute per either the host platform or Windows
 * conventions. `prime-agent package list` prints installed package paths in
 * the host's native format (`/home/user/...` on POSIX, `C:\Users\...` on
 * Windows), so the version lookup must accept both forms. On a POSIX host a
 * Windows-style path fails the subsequent fs read and falls back to 'unknown',
 * preserving prior behavior; on a Windows host the same read succeeds.
 */
const isPrimeAbsolutePath = (p: string): boolean => isAbsolute(p) || win32.isAbsolute(p);

/**
 * Read the installed version from `prime-agent package list` output. Only the
 * user-scope section is considered (project registrations are not managed
 * here), and only the path line printed directly below our source line is
 * used - later absolute paths belong to subsequent package entries. Falls back
 * to 'unknown' when the package is not listed, its entry has no installed
 * path, or the installed package.json cannot be read.
 */
const primeMaestriaInstalledVersion = (output: string): Effect.Effect<string, CommandError> => {
  const lines = primeUserScopeLines(output);
  const sourceIndex = lines.findIndex((line) => PRIME_MAESTRIA_SOURCE_RE.test(line));
  if (sourceIndex === -1) {
    return Effect.succeed('unknown');
  }

  const installedPath = lines[sourceIndex + 1]?.trim();
  if (!installedPath || !isPrimeAbsolutePath(installedPath)) {
    return Effect.succeed('unknown');
  }

  return readPackageJsonVersion(`${installedPath}/package.json`).pipe(
    Effect.catchCause(() => Effect.succeed('unknown')),
  );
};

/**
 * Create a fresh empty temporary working directory for Prime Agent package
 * commands. Prime's `package list`/`update` resolve project settings from the
 * current working directory, so every Prime command runs from an isolated
 * empty directory: only the user (global) scope can be read or written, and a
 * project's registrations are never scanned or modified. Fails closed with a
 * CommandError when the directory cannot be created, blocking the operation
 * before any Prime command runs.
 */
const primeTempCwd = (): Effect.Effect<string, CommandError> =>
  Effect.tryPromise({
    catch: (error) =>
      new CommandError({
        command: `create isolated temp cwd (${tmpdir()}/maestria-prime-*)`,
        message: `Failed to create an isolated working directory for Prime Agent: ${String(error)}`,
      }),
    try: async () => {
      const { mkdtemp } = await import('node:fs/promises');
      return await mkdtemp(join(tmpdir(), 'maestria-prime-'));
    },
  });

/** Remove a Prime Agent temp cwd. Best-effort: cleanup failures are ignored. */
const removePrimeTempCwd = (dir: string): Effect.Effect<void> =>
  Effect.tryPromise({
    catch: () => {
      /* empty */
    },
    try: async () => {
      const { rm } = await import('node:fs/promises');
      await rm(dir, { force: true, recursive: true });
    },
  }).pipe(Effect.catchCause(() => Effect.void));

/**
 * Run a Prime Agent package command from a freshly created empty temporary
 * working directory. The directory is removed after the command completes on
 * both success and failure (Effect.ensuring), and temp-cwd creation failures
 * fail closed with a CommandError before the command runs.
 */
const withPrimeTempCwd = <T>(
  effect: (cwd: string) => Effect.Effect<T, CommandError>,
): Effect.Effect<T, CommandError> =>
  Effect.gen(function* withPrimeTempCwdEffect() {
    const cwd = yield* primeTempCwd();
    return yield* effect(cwd).pipe(Effect.ensuring(removePrimeTempCwd(cwd)));
  });

/**
 * `prime-agent package list` output, read from an isolated empty temp cwd so
 * project settings are never consulted. Shared by detection, version reads,
 * and the per-update snapshot; the update flow captures it once per update.
 */
const primePackageList: Effect.Effect<string, CommandError> = withPrimeTempCwd((cwd) =>
  run('prime-agent', ['package', 'list'], 120_000, cwd),
);

/**
 * Capture the per-update registration snapshot: one `prime-agent package list`
 * read whose parsed installed version and pinned-source state are reused by
 * the update command's version check, preflight, and update step.
 */
const primeUpdateSnapshot = (): Effect.Effect<PlatformUpdateSnapshot, CommandError> =>
  Effect.gen(function* primeUpdateSnapshotEffect() {
    const list = yield* primePackageList;
    return {
      installedVersion: yield* primeMaestriaInstalledVersion(list),
      pinnedSource: primeMaestriaPinnedSource(list),
    };
  });

/**
 * Update preflight for Prime Agent. Fails with a CommandError when the
 * user-scope maestria registration is version-pinned, because Prime skips
 * `package update` for pinned registrations. When a per-update snapshot is
 * available it is used (no extra `package list`); otherwise the registration
 * state is read now, so a direct handler call fails closed for a pinned
 * registration too. The update command runs this before its "Already up to
 * date" short-circuit, so a pinned registration can never be reported as a
 * successful no-op update.
 */
const primeUpdatePreflight = (
  snapshot?: PlatformUpdateSnapshot,
): Effect.Effect<void, CommandError> =>
  Effect.gen(function* primeUpdatePreflightEffect() {
    // A captured snapshot already knows the pinned state (pinned or not); only
    // a direct call without a snapshot (e.g. invoking the handler's update in
    // isolation) needs to read the registration state now.
    const pinnedSource =
      snapshot === undefined
        ? yield* primePackageList.pipe(Effect.map(primeMaestriaPinnedSource))
        : snapshot.pinnedSource;
    if (pinnedSource !== null && pinnedSource !== undefined && pinnedSource !== '') {
      yield* Effect.fail(
        new CommandError({
          command: `prime-agent package update ${PRIME_MAESTRIA_SOURCE}`,
          message:
            `Prime Agent package registration is version-pinned (${pinnedSource}); ` +
            'Prime skips updates for pinned registrations. Remove the version ' +
            'from the registration to update to latest.',
        }),
      );
    }
  }).pipe(Effect.asVoid);

const primeAgent: PlatformDefinition = {
  captureUpdateSnapshot: primeUpdateSnapshot(),
  detect: commandExists('prime-agent'),
  getInstalledVersion: primePackageList.pipe(
    Effect.flatMap(primeMaestriaInstalledVersion),
    Effect.catchCause(() => Effect.succeed('unknown')),
  ),
  id: 'prime-agent',
  install: withPrimeTempCwd((cwd) =>
    run('prime-agent', ['package', 'install', PRIME_MAESTRIA_SOURCE], 120_000, cwd),
  ).pipe(Effect.asVoid),
  isInstalled: primePackageList.pipe(
    Effect.map(hasPrimeMaestriaPackage),
    Effect.catchCause(() => Effect.succeed(false)),
  ),
  label: 'Prime Agent',
  npmPackage: '@maestria/prime-agent',
  // Runs before the update command's "Already up to date" short-circuit so a
  // version-pinned registration is reported as an error even when the
  // installed version already equals the latest.
  preflightUpdate: (snapshot?: PlatformUpdateSnapshot) => primeUpdatePreflight(snapshot),
  supportsVersionPinning: false,
  uninstall: withPrimeTempCwd((cwd) =>
    run('prime-agent', ['package', 'remove', PRIME_MAESTRIA_SOURCE], 60_000, cwd),
  ).pipe(Effect.asVoid),
  // One per-update inspection shared by the version check, the preflight, and
  // the update step, so a normal update lists registrations once before and
  // once after the update command instead of once per step.
  update: (_version?: string, snapshot?: PlatformUpdateSnapshot) =>
    Effect.gen(function* update() {
      // Prime skips `package update` for version-pinned registrations. Detect
      // that state up front (from the per-update snapshot when available) and
      // fail with an accurate message rather than reporting a fake success
      // (which would also invalidate the version cache for a package that was
      // not updated).
      yield* primeUpdatePreflight(snapshot);
      yield* withPrimeTempCwd((cwd) =>
        run('prime-agent', ['package', 'update', PRIME_MAESTRIA_SOURCE], 120_000, cwd),
      );
    }).pipe(Effect.asVoid),
};

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
      yield* invalidateVersionCache(options.invalidatePackage).pipe(
        Effect.catchCause(() => Effect.void),
      );
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
      Effect.catchCause(() => Effect.succeed('unknown')),
    ),
  ),
  id: 'kimi-code',
  install: replacePlatformPayload({
    // Validate the host registry before the tarball helper replaces the managed
    // directory. Kimi's plugin manager treats malformed installed.json as a
    // load failure, so do not destroy the current copy before surfacing it.
    capture: readKimiInstalled,
    replace: () => installNpmTarball('@maestria/kimi-code', kimiManagedPluginDir()),
    restore: registerKimiPlugin,
  }),
  isInstalled: readKimiInstalled().pipe(
    Effect.map((file) => file.plugins.some((plugin) => plugin.id === MAESTRIA_PLUGIN)),
    Effect.flatMap((installed) =>
      installed ? Effect.succeed(true) : fileExists(`${kimiManagedPluginDir()}/kimi.plugin.json`),
    ),
    Effect.catchCause(() => Effect.succeed(false)),
  ),
  label: 'Kimi Code',
  npmPackage: '@maestria/kimi-code',
  uninstall: removeKimiPlugin().pipe(Effect.asVoid),
  update: (version?: string) =>
    replacePlatformPayload({
      capture: readKimiInstalled,
      invalidatePackage: '@maestria/kimi-code',
      replace: () =>
        installNpmTarball('@maestria/kimi-code', kimiManagedPluginDir(), {
          tag: version ?? 'latest',
        }),
      restore: registerKimiPlugin,
    }),
};

const hermes: PlatformDefinition = {
  detect: commandExists('hermes'),
  getInstalledVersion: readTextFile(
    `${homedir()}/.hermes/plugins/maestria-hermes/plugin.yaml`,
  ).pipe(
    Effect.map((out: string) => {
      const match = /^version:\s*["']?(?<version>.+?)["']?\s*$/mu.exec(out);
      return match?.groups?.version ?? 'unknown';
    }),
    Effect.catchCause(() => Effect.succeed('unknown')),
  ),
  getLatestVersion: Effect.succeed('see GitHub releases'),
  id: 'hermes',
  // No npmPackage - distributed via hermes plugins install (git-based)
  install: Effect.gen(function* install() {
    yield* run(
      'hermes',
      ['plugins', 'install', 'agustinusnathaniel/maestria/packages/hermes', '--enable'],
      120_000,
    );
  }).pipe(Effect.asVoid),

  isInstalled: fileExists(`${homedir()}/.hermes/plugins/maestria-hermes/plugin.yaml`),
  label: 'Hermes',
  uninstall: Effect.gen(function* uninstall() {
    yield* run('hermes', ['plugins', 'remove', 'maestria-hermes'], 15_000);
  }).pipe(Effect.asVoid),
  update: (_version?: string) =>
    Effect.gen(function* update() {
      if (_version !== null && _version !== undefined && _version !== '') {
        console.log(
          `  ${picocolors.yellow('⚠')} Version pinning is not supported for git-based Hermes plugins. ` +
            `Updating to latest from git.`,
        );
      }
      yield* run('hermes', ['plugins', 'update', 'maestria-hermes'], 60_000);
    }),
};

const CURSOR_PLUGIN_DIR = `${homedir()}/.cursor/plugins/local/maestria`;
const CURSOR_PLUGIN_JSON = `${CURSOR_PLUGIN_DIR}/.cursor-plugin/plugin.json`;
export const CURSOR_AGENT_NAMES = MAESTRIA_AGENTS;

/** Capture configured Cursor plugin-agent models before a package update replaces the plugin. */
const readCursorAgentModels = (): Effect.Effect<Record<string, string>, CommandError> =>
  Effect.tryPromise({
    catch: (error) =>
      new CommandError({
        command: `read Cursor agent models from ${CURSOR_PLUGIN_DIR}/agents`,
        message: String(error),
      }),
    try: async () => {
      const { readFile } = await import('node:fs/promises');
      const entries = await Promise.all(
        CURSOR_AGENT_NAMES.map(async (agent) => {
          try {
            const content = await readFile(`${CURSOR_PLUGIN_DIR}/agents/${agent}.md`, 'utf-8');
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
        command: `restore Cursor agent models in ${CURSOR_PLUGIN_DIR}/agents`,
        message: String(error),
      }),
    try: async () => {
      const { mkdir, readFile, writeFile } = await import('node:fs/promises');
      const agentDir = `${CURSOR_PLUGIN_DIR}/agents`;
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
    Effect.catchCause(() => Effect.succeed('unknown')),
  ),
  id: 'cursor',
  install: replacePlatformPayload({
    capture: readCursorAgentModels,
    replace: () =>
      ensureCursorPluginParentDirectory().pipe(
        Effect.flatMap(() => installNpmTarball('@maestria/cursor', CURSOR_PLUGIN_DIR)),
      ),
    restore: restoreCursorAgentModels,
  }),
  isInstalled: fileExists(CURSOR_PLUGIN_JSON),
  label: 'Cursor',
  npmPackage: '@maestria/cursor',
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
      invalidatePackage: '@maestria/cursor',
      replace: () =>
        installNpmTarball('@maestria/cursor', CURSOR_PLUGIN_DIR, { tag: version ?? 'latest' }),
      restore: restoreCursorAgentModels,
    }),
};

// omp has built-in task dispatch, so it has no subagent prerequisite.
const omp: PlatformDefinition = piStylePlatform({
  binary: 'omp',
  commandPrefix: ['plugin'],
  id: 'omp',
  installedPackageJsonPath: `${homedir()}/.omp/plugins/node_modules/@maestria/omp/package.json`,
  label: 'Oh My Pi',
  npmPackage: '@maestria/omp',
  referencePrefix: '',
});

// ── Registry ─────────────────────────────────────────
export const platforms: readonly PlatformHandler[] = [
  opencode,
  pi,
  primeAgent,
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
