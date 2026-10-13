// oxlint-disable max-lines -- single cohesive platform registry; splitting would fragment lookup.
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

const readOpenCodeConfig = (): Effect.Effect<string, CommandError> => {
  const jsoncPath = `${homedir()}/.config/opencode/opencode.jsonc`;
  const jsonPath = `${homedir()}/.config/opencode/opencode.json`;
  return readTextFile(jsoncPath).pipe(
    Effect.catchTag('CommandError', () => readTextFile(jsonPath)),
  );
};

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

/** Missing/malformed/non-string versions resolve to 'unknown'. */
const manifestVersion = (manifest: JsonRecord | undefined): string =>
  typeof manifest?.version === 'string' ? manifest.version : 'unknown';

/** Reads via fs/promises so Windows-format paths work on their host. */
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

interface NpmMarketplace {
  readonly command: 'claude' | 'codex';
  readonly dir: string;
  readonly file: string;
  readonly manifest: JsonRecord;
  readonly packageName: string;
}

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
  // Shared by install and update; host fetches keep the 120s deadline.
  run('claude', ['plugin', 'marketplace', 'update', MAESTRIA_MARKETPLACE], 120_000).pipe(
    Effect.asVoid,
  );

// Stage, refresh, then materialize through the host CLI (120s host deadline).
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

/** Single source for the platform ID union. */
export const PLATFORM_IDS = [
  'opencode',
  'omp',
  'pi',
  'kimi-code',
  'hermes',
  'cursor',
  'claude-code',
  'codex',
  'deepseek',
] as const;

export type PlatformId = (typeof PLATFORM_IDS)[number];

/**
 * Per-update host state captured once and shared by the version check,
 * preflight, and update step.
 */
export interface PlatformUpdateSnapshot {
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
  readonly captureUpdateSnapshot?: Effect.Effect<PlatformUpdateSnapshot, CommandError>;
  /**
   * Runs before the "Already up to date" short-circuit so ineligible state is
   * never reported as a successful no-op.
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

/** `npmPackage` derives `getLatestVersion`, so the two cannot drift apart. */
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

      // Global install uses -g; cold fetches keep install's 120s deadline.
      const globalConfig = yield* readOpenCodeConfig().pipe(
        Effect.map((out) => out.includes('@maestria/opencode')),
        Effect.catchEager(() => Effect.succeed(false)),
      );
      const flag = globalConfig ? ['-g', '--force'] : ['--force'];
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

// Host fetches keep the 120s deadline instead of the 30s default.
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
      // No plugin update command; remove-then-add is the supported update path.
      yield* runCodexPlugin('remove');
      yield* runCodexPlugin('add');
      yield* installCodexManagedAgents(`${CODEX_MARKETPLACE_DIR}/plugins/${MAESTRIA_PLUGIN}`);
    }),
};

// ── DeepSeek Harness ─────────────────────────────────

const dshHomePath = (): string => {
  const fromEnv = process.env.DSH_HOME?.trim();
  return fromEnv !== undefined && fromEnv !== '' ? fromEnv : `${homedir()}/.dsh`;
};
const deepseekPresetDir = (): string => `${dshHomePath()}/.agent-presets/maestria`;
const DEEPSEEK_STAGING_DIR = join(getMaestriaCacheDir(), 'deepseek-package');

/**
 * Stage the Maestria agent preset into the harness's user preset root.
 *
 * The npm tarball is extracted into a cache staging dir, then the preset
 * composition (`preset/maestria`) and the bundled plugin (`dist`) are copied
 * into `<dshHome>/.agent-presets/maestria`. The preset references the plugin
 * by the relative `./plugin/index.js`, so the staged preset is
 * self-contained and needs no npm resolvability at harness runtime.
 */
const stageDeepseekPreset = (tag: string): Effect.Effect<void, CommandError> =>
  Effect.gen(function* stageDeepseekPresetEffect() {
    yield* installNpmTarball('@maestria/deepseek', DEEPSEEK_STAGING_DIR, { tag });
    yield* Effect.tryPromise({
      catch: (error) =>
        new CommandError({
          command: `stage preset into ${deepseekPresetDir()}`,
          message: String(error),
        }),
      try: async () => {
        const { cp, mkdir, rm } = await import('node:fs/promises');
        const presetDir = deepseekPresetDir();
        await rm(presetDir, { force: true, recursive: true });
        await mkdir(presetDir, { recursive: true });
        await cp(join(DEEPSEEK_STAGING_DIR, 'preset', 'maestria'), presetDir, { recursive: true });
        await cp(join(DEEPSEEK_STAGING_DIR, 'dist'), join(presetDir, 'plugin'), {
          recursive: true,
        });
      },
    });
  }).pipe(Effect.asVoid);

const deepseek: PlatformDefinition = {
  detect: Effect.gen(function* detect() {
    if (yield* commandExists('dsh')) {
      return true;
    }
    return yield* fileExists(`${deepseekPresetDir()}/agent.cordis.yml`);
  }),
  getInstalledVersion: Effect.suspend(() =>
    readPackageJsonVersion(`${deepseekPresetDir()}/plugin/package.json`).pipe(
      Effect.catchCause(() => Effect.succeed('unknown')),
    ),
  ),
  id: 'deepseek',
  install: stageDeepseekPreset('latest'),
  isInstalled: fileExists(`${deepseekPresetDir()}/agent.cordis.yml`),
  label: 'DeepSeek Harness',
  npmPackage: '@maestria/deepseek',
  uninstall: Effect.tryPromise({
    catch: (error) =>
      new CommandError({
        command: `rm -r ${deepseekPresetDir()}`,
        message: String(error),
      }),
    try: async () => {
      const { rm } = await import('node:fs/promises');
      await rm(deepseekPresetDir(), { force: true, recursive: true });
    },
  }).pipe(Effect.asVoid),
  update: (version?: string) => stageDeepseekPreset(version ?? 'latest'),
};

/** Pi and omp share one handler shape; only spelling, prefix, path, and labels differ. */
interface PiStylePlatformDefinition {
  readonly id: 'pi' | 'omp';
  readonly label: string;
  readonly binary: string;
  readonly npmPackage: string;
  /** Host installer requires `npm:` for Pi, empty for omp. */
  readonly referencePrefix: string;
  readonly commandPrefix: readonly string[];
  readonly installedPackageJsonPath: string;
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

/** Pinned in step with the workspace catalog; bare latest can violate the peer range. */
const PI_SUBAGENTS_RANGE = '^21.5.1';

/** Installed before every install/update; failures are ignored. */
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
 * Replace a payload while preserving host state. Capture failures abort
 * before anything is destroyed; thunks resolve env paths at run time.
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
    // Kimi treats malformed installed.json as a load failure; validate first.
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
      ['plugins', 'install', 'agustinusnathaniel/maestria/packages/agent-plugins', '--enable'],
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
const CURSOR_AGENT_DIR = `${CURSOR_PLUGIN_DIR}/agents`;
// Pre-shared-profile installs kept models in a Cursor-only copy.
const LEGACY_CURSOR_AGENT_DIR = `${CURSOR_PLUGIN_DIR}/agents/cursor`;

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
        MAESTRIA_AGENTS.map(async (agent) => {
          const readModel = async (directory: string): Promise<string | undefined> => {
            try {
              const content = await readFile(`${directory}/${agent}.md`, 'utf-8');
              const model = parseAgentFrontmatterModel(content, { unquote: true });
              return model === '' ? undefined : model;
            } catch (error) {
              if (isFileNotFound(error)) {
                return undefined;
              }
              throw error;
            }
          };
          // Shared profile wins; fallback is the pre-consolidation Cursor-only copy.
          const [shared, legacy] = await Promise.all([
            readModel(CURSOR_AGENT_DIR),
            readModel(LEGACY_CURSOR_AGENT_DIR),
          ]);
          const model = shared ?? legacy;
          return model === undefined ? null : ([agent, model] as const);
        }),
      );
      return Object.fromEntries(entries.filter((entry) => entry !== null));
    },
  });

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
    // An unrelated `agent` binary must not match the ~/.cursor fallback.
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

// OMP loads the consolidated plugin natively; no hooks or model files ship.
// Migrating from `@maestria/omp` requires manual uninstall first.
const omp: PlatformDefinition = piStylePlatform({
  binary: 'omp',
  commandPrefix: ['plugin'],
  id: 'omp',
  installedPackageJsonPath: `${homedir()}/.omp/plugins/node_modules/@maestria/agent-plugins/package.json`,
  label: 'Oh My Pi',
  npmPackage: MAESTRIA_PLUGIN_PACKAGE,
  referencePrefix: '',
});
export const platforms: readonly PlatformHandler[] = [
  opencode,
  pi,
  kimiCode,
  hermes,
  cursor,
  omp,
  claudeCode,
  codex,
  deepseek,
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
