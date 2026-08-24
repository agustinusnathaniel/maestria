import { Effect } from 'effect';
import { homedir, tmpdir } from 'os';
import { isAbsolute, win32 } from 'node:path';
import picocolors from 'picocolors';

import {
  run,
  sh,
  commandExists,
  npmViewVersion,
  invalidateVersionCache,
  CommandError,
} from '@/lib/shell.js';

// ── Shared helpers ───────────────────────────────────

/** Read OpenCode config file, trying .jsonc first then .json */
function readOpenCodeConfig(): Effect.Effect<string, CommandError> {
  const jsoncPath = `${homedir()}/.config/opencode/opencode.jsonc`;
  const jsonPath = `${homedir()}/.config/opencode/opencode.json`;
  return run('cat', [jsoncPath], 5_000).pipe(
    Effect.catchCause(() => run('cat', [jsonPath], 5_000)),
  );
}

/**
 * Install a package from an npm tarball into a destination directory.
 *
 * Shared by the kimi-code and cursor platform handlers, which both pack
 * @maestria/* packages to /tmp and extract them into their platform's
 * plugin directory. The tarball name derives from the package name with
 * the @maestria/ scope stripped (e.g. @maestria/kimi-code ->
 * maestria-kimi-code-*.tgz).
 *
 * @param pkg    Full npm package name (e.g. '@maestria/kimi-code')
 * @param dest   Destination directory to extract into
 * @param opts   Optional tag (default 'latest') and a post-extract copy step
 */
function installNpmTarball(
  pkg: string,
  dest: string,
  opts: { tag?: string; copyFrom?: string; copyTo?: string } = {},
): Effect.Effect<void, CommandError> {
  const tag = opts.tag ?? 'latest';
  const shortName = pkg.replace('@maestria/', '');
  const tarballGlob = `/tmp/maestria-${shortName}-*.tgz`;

  return Effect.gen(function* () {
    // Remove stale tarballs and the destination dir before installing
    yield* sh(`rm -rf ${tarballGlob} "${dest}"`, 15_000);

    const copyStep =
      opts.copyFrom && opts.copyTo ? ` && cp "${dest}/${opts.copyFrom}" "${opts.copyTo}"` : '';

    yield* sh(
      `npm pack ${pkg}@${tag} --pack-destination /tmp && ` +
        `mkdir -p "${dest}" && ` +
        `tar -xzf ${tarballGlob} -C "${dest}" --strip-components=1${copyStep} && ` +
        `rm -f ${tarballGlob}`,
      120_000,
    );
  });
}

const CLAUDE_MARKETPLACE_DIR = `${homedir()}/.cache/maestria/claude-code-marketplace`;
const CODEX_MARKETPLACE_DIR = `${homedir()}/.cache/maestria/codex-marketplace`;
const MAESTRIA_MARKETPLACE = 'maestria';
const MAESTRIA_PLUGIN = 'maestria';

type JsonRecord = Record<string, unknown>;

function jsonRecords(output: string, key?: string): JsonRecord[] {
  try {
    const parsed: unknown = JSON.parse(output);
    const value =
      key && typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? (parsed as JsonRecord)[key]
        : parsed;

    return Array.isArray(value)
      ? value.filter((entry): entry is JsonRecord => typeof entry === 'object' && entry !== null)
      : [];
  } catch {
    return [];
  }
}

function hasMarketplace(output: string): boolean {
  return jsonRecords(output, 'marketplaces').some(
    (marketplace) => marketplace.name === MAESTRIA_MARKETPLACE,
  );
}

function hasMaestriaPlugin(output: string): boolean {
  return jsonRecords(output, 'installed').some((plugin) => {
    const pluginId =
      typeof plugin.pluginId === 'string'
        ? plugin.pluginId
        : typeof plugin.id === 'string'
          ? plugin.id
          : '';
    const name = typeof plugin.name === 'string' ? plugin.name : '';
    const marketplaceName =
      typeof plugin.marketplaceName === 'string' ? plugin.marketplaceName : '';
    return (
      pluginId === `${MAESTRIA_PLUGIN}@${MAESTRIA_MARKETPLACE}` ||
      (name === MAESTRIA_PLUGIN && marketplaceName === MAESTRIA_MARKETPLACE)
    );
  });
}

function installedMaestriaVersion(output: string): string {
  const plugin = jsonRecords(output, 'installed').find((entry) => {
    const pluginId =
      typeof entry.pluginId === 'string'
        ? entry.pluginId
        : typeof entry.id === 'string'
          ? entry.id
          : '';
    const name = typeof entry.name === 'string' ? entry.name : '';
    const marketplaceName = typeof entry.marketplaceName === 'string' ? entry.marketplaceName : '';
    return (
      pluginId === `${MAESTRIA_PLUGIN}@${MAESTRIA_MARKETPLACE}` ||
      (name === MAESTRIA_PLUGIN && marketplaceName === MAESTRIA_MARKETPLACE)
    );
  });
  return typeof plugin?.version === 'string' ? plugin.version : 'unknown';
}

function hostPluginList(command: 'claude' | 'codex'): Effect.Effect<string, CommandError> {
  return Effect.suspend(() => run(command, ['plugin', 'list', '--json']));
}

function prepareNpmMarketplace(
  pkg: string,
  marketplaceDir: string,
  marketplaceFile: string,
  manifest: JsonRecord,
): Effect.Effect<void, CommandError> {
  const pluginDir = `${marketplaceDir}/plugins/${MAESTRIA_PLUGIN}`;
  const marketplacePath = `${marketplaceDir}/${marketplaceFile}`;

  return Effect.gen(function* () {
    yield* installNpmTarball(pkg, pluginDir);
    yield* Effect.tryPromise({
      try: async () => {
        const { mkdir, writeFile } = await import('node:fs/promises');
        const { dirname } = await import('node:path');
        await mkdir(dirname(marketplacePath), { recursive: true });
        await writeFile(marketplacePath, `${JSON.stringify(manifest, null, 2)}\n`);
      },
      catch: (error) =>
        new CommandError({
          command: `write ${marketplacePath}`,
          message: String(error),
        }),
    });
  });
}

const claudeMarketplaceManifest: JsonRecord = {
  $schema: 'https://anthropic.com/claude-code/marketplace.schema.json',
  name: MAESTRIA_MARKETPLACE,
  owner: {
    name: 'Agustinus Nathaniel',
    url: 'https://github.com/agustinusnathaniel',
  },
  plugins: [
    {
      name: MAESTRIA_PLUGIN,
      displayName: 'Maestria',
      source: './plugins/maestria',
    },
  ],
};

const codexMarketplaceManifest: JsonRecord = {
  name: MAESTRIA_MARKETPLACE,
  interface: { displayName: 'Maestria' },
  plugins: [
    {
      name: MAESTRIA_PLUGIN,
      source: { source: 'local', path: './plugins/maestria' },
      policy: { installation: 'AVAILABLE', authentication: 'ON_USE' },
      category: 'Developer Tools',
    },
  ],
};

function ensureClaudeMarketplace(): Effect.Effect<void, CommandError> {
  return run('claude', ['plugin', 'marketplace', 'list', '--json']).pipe(
    Effect.flatMap((output) =>
      hasMarketplace(output)
        ? Effect.void
        : run('claude', ['plugin', 'marketplace', 'add', CLAUDE_MARKETPLACE_DIR]).pipe(
            Effect.as(void 0),
          ),
    ),
  );
}

function ensureCodexMarketplace(): Effect.Effect<void, CommandError> {
  return run('codex', ['plugin', 'marketplace', 'list', '--json']).pipe(
    Effect.flatMap((output) =>
      hasMarketplace(output)
        ? Effect.void
        : run('codex', ['plugin', 'marketplace', 'add', CODEX_MARKETPLACE_DIR]).pipe(
            Effect.as(void 0),
          ),
    ),
  );
}

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
  readonly id: string;
  readonly label: string;
  readonly npmPackage?: string;
  readonly detect: Effect.Effect<boolean, never>;
  readonly isInstalled: Effect.Effect<boolean, never>;
  readonly getInstalledVersion: Effect.Effect<string, CommandError>;
  readonly getLatestVersion: Effect.Effect<string, never>;
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

const opencode: PlatformHandler = {
  id: 'opencode',
  label: 'OpenCode',
  npmPackage: '@maestria/opencode',

  detect: commandExists('opencode'),

  isInstalled: readOpenCodeConfig().pipe(
    Effect.map((out) => out.includes('@maestria/opencode')),
    Effect.catchCause(() => Effect.succeed(false)),
  ),

  getInstalledVersion: readOpenCodeConfig().pipe(
    Effect.map((config) => {
      const match = config.match(/@maestria\/opencode@(.+?)"/);
      return match?.[1] ?? null;
    }),
    Effect.flatMap((specifier) => {
      if (!specifier) return Effect.succeed('unknown');
      return run('cat', [
        `${homedir()}/.cache/opencode/packages/@maestria/opencode@${specifier}/node_modules/@maestria/opencode/package.json`,
      ]).pipe(
        Effect.map((out) => {
          try {
            const pkg: { version?: string } = JSON.parse(out);
            return pkg.version ?? 'unknown';
          } catch {
            return 'unknown';
          }
        }),
      );
    }),
    Effect.catchCause(() => Effect.succeed('unknown')),
  ),

  getLatestVersion: npmViewVersion('@maestria/opencode'),

  install: Effect.gen(function* () {
    // Clear cache to ensure fresh install from npm
    yield* sh(`rm -rf ${homedir()}/.cache/opencode/packages/@maestria/opencode*`);
    // Install globally by default - install is a setup command, not per-project
    yield* sh('opencode plugin @maestria/opencode@latest -g', 120_000);
  }).pipe(Effect.as(void 0)),

  update: (version?: string) =>
    Effect.gen(function* () {
      const tag = version ?? 'latest';

      // Clear cache to ensure fresh install from npm
      yield* sh(`rm -rf ${homedir()}/.cache/opencode/packages/@maestria/opencode*`);

      // Check if installed globally or at project level
      const globalConfig = yield* readOpenCodeConfig().pipe(
        Effect.map((out) => out.includes('@maestria/opencode')),
        Effect.catchCause(() => Effect.succeed(false)),
      );
      const flag = globalConfig ? ['-g', '--force'] : ['--force'];
      yield* run('opencode', ['plugin', `@maestria/opencode@${tag}`, ...flag]);
    }),

  uninstall: Effect.sync(() => {
    console.log(
      `\n  To uninstall OpenCode:\n` +
        `  1. Edit ~/.config/opencode/opencode.jsonc (or .opencode/opencode.jsonc in your project)\n` +
        `  2. Remove "@maestria/opencode@latest" from the "plugin" array\n` +
        `  3. Optionally clear cache: rm -rf ~/.cache/opencode/packages/@maestria/opencode*\n`,
    );
  }),
};

const claudeCode: PlatformHandler = {
  id: 'claude-code',
  label: 'Claude Code',
  npmPackage: '@maestria/claude-code',
  supportsVersionPinning: false,

  detect: commandExists('claude'),

  isInstalled: hostPluginList('claude').pipe(
    Effect.map(hasMaestriaPlugin),
    Effect.catchCause(() => Effect.succeed(false)),
  ),

  getInstalledVersion: hostPluginList('claude').pipe(
    Effect.map(installedMaestriaVersion),
    Effect.catchCause(() => Effect.succeed('unknown')),
  ),

  getLatestVersion: npmViewVersion('@maestria/claude-code'),

  install: Effect.gen(function* () {
    yield* prepareNpmMarketplace(
      '@maestria/claude-code',
      CLAUDE_MARKETPLACE_DIR,
      '.claude-plugin/marketplace.json',
      claudeMarketplaceManifest,
    );
    yield* ensureClaudeMarketplace();
    yield* run('claude', [
      'plugin',
      'install',
      `${MAESTRIA_PLUGIN}@${MAESTRIA_MARKETPLACE}`,
      '--scope',
      'user',
    ]);
  }).pipe(Effect.as(void 0)),

  update: (_version?: string) =>
    Effect.gen(function* () {
      yield* prepareNpmMarketplace(
        '@maestria/claude-code',
        CLAUDE_MARKETPLACE_DIR,
        '.claude-plugin/marketplace.json',
        claudeMarketplaceManifest,
      );
      yield* ensureClaudeMarketplace();
      yield* run('claude', [
        'plugin',
        'uninstall',
        `${MAESTRIA_PLUGIN}@${MAESTRIA_MARKETPLACE}`,
        '--scope',
        'user',
      ]);
      yield* run('claude', [
        'plugin',
        'install',
        `${MAESTRIA_PLUGIN}@${MAESTRIA_MARKETPLACE}`,
        '--scope',
        'user',
      ]);
    }),

  uninstall: Effect.suspend(() =>
    run('claude', [
      'plugin',
      'uninstall',
      `${MAESTRIA_PLUGIN}@${MAESTRIA_MARKETPLACE}`,
      '--scope',
      'user',
    ]),
  ).pipe(Effect.as(void 0)),
};

const codex: PlatformHandler = {
  id: 'codex',
  label: 'Codex CLI',
  npmPackage: '@maestria/codex',
  supportsVersionPinning: false,

  detect: commandExists('codex'),

  isInstalled: hostPluginList('codex').pipe(
    Effect.map(hasMaestriaPlugin),
    Effect.catchCause(() => Effect.succeed(false)),
  ),

  getInstalledVersion: hostPluginList('codex').pipe(
    Effect.map(installedMaestriaVersion),
    Effect.catchCause(() => Effect.succeed('unknown')),
  ),

  getLatestVersion: npmViewVersion('@maestria/codex'),

  install: Effect.gen(function* () {
    yield* prepareNpmMarketplace(
      '@maestria/codex',
      CODEX_MARKETPLACE_DIR,
      '.agents/plugins/marketplace.json',
      codexMarketplaceManifest,
    );
    yield* ensureCodexMarketplace();
    yield* run('codex', ['plugin', 'add', `${MAESTRIA_PLUGIN}@${MAESTRIA_MARKETPLACE}`, '--json']);
  }).pipe(Effect.as(void 0)),

  update: (_version?: string) =>
    Effect.gen(function* () {
      yield* prepareNpmMarketplace(
        '@maestria/codex',
        CODEX_MARKETPLACE_DIR,
        '.agents/plugins/marketplace.json',
        codexMarketplaceManifest,
      );
      yield* ensureCodexMarketplace();
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
    }),

  uninstall: Effect.suspend(() =>
    run('codex', ['plugin', 'remove', `${MAESTRIA_PLUGIN}@${MAESTRIA_MARKETPLACE}`, '--json']),
  ).pipe(Effect.as(void 0)),
};

const pi: PlatformHandler = {
  id: 'pi',
  label: 'Pi',
  npmPackage: '@maestria/pi',

  detect: commandExists('pi'),

  isInstalled: run(
    'ls',
    [`${homedir()}/.pi/agent/npm/node_modules/@maestria/pi/package.json`],
    2_000,
  ).pipe(
    Effect.map(() => true),
    Effect.catchCause(() => Effect.succeed(false)),
  ),

  getInstalledVersion: run('cat', [
    `${homedir()}/.pi/agent/npm/node_modules/@maestria/pi/package.json`,
  ]).pipe(
    Effect.map((out: string) => {
      try {
        const pkg: { version?: string } = JSON.parse(out);
        return pkg.version ?? 'unknown';
      } catch {
        return 'unknown';
      }
    }),
    Effect.catchCause(() => Effect.succeed('unknown')),
  ),

  getLatestVersion: npmViewVersion('@maestria/pi'),

  install: Effect.gen(function* () {
    // Install prerequisite: @gotgenes/pi-subagents for subagent dispatch
    yield* run('pi', ['install', 'npm:@gotgenes/pi-subagents'], 60_000).pipe(
      Effect.catchCause(() => Effect.void),
    );
    // Install main package
    yield* run('pi', ['install', 'npm:@maestria/pi'], 120_000);
  }).pipe(Effect.as(void 0)),

  update: (version?: string) =>
    Effect.gen(function* () {
      const tagged = version ? `npm:@maestria/pi@${version}` : 'npm:@maestria/pi@latest';
      // Ensure pi-subagents is installed (may not be for users who installed before v0.4.1)
      yield* run('pi', ['install', 'npm:@gotgenes/pi-subagents'], 60_000).pipe(
        Effect.catchCause(() => Effect.void),
      );
      yield* run('pi', ['install', tagged], 120_000);
    }),

  uninstall: run('pi', ['uninstall', 'npm:@maestria/pi']).pipe(Effect.as(void 0)),
};

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
const PRIME_MAESTRIA_SOURCE_RE = /^\s*npm:@maestria\/prime-agent(?:@\S+)?(?:\s+\(filtered\))?\s*$/;

/**
 * Match a version-pinned npm source registration, i.e. one with an explicit
 * @version/ref suffix (e.g. `npm:@maestria/prime-agent@0.2.0`). Prime skips
 * `package update` for pinned registrations, so the CLI must not report a
 * successful update for them.
 */
const PRIME_MAESTRIA_PINNED_RE = /^npm:@maestria\/prime-agent@\S+(?:\s+\(filtered\))?$/;

/**
 * ANSI SGR escape sequence matcher, used to strip bold/dim styling from
 * `prime-agent package list` section headers and installed-path lines. The
 * ESC byte is produced via String.fromCharCode so no control character is
 * embedded in the source (eslint no-control-regex).
 */
const ANSI_SGR_RE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

/**
 * Extract the user (global) scope section of `prime-agent package list`
 * output. Prime prints a "User packages:" section followed by a "Project
 * packages:" section; only the user section is managed by this CLI. Section
 * headers are styled bold when printed to a TTY, so ANSI codes are stripped
 * before matching. Returns [] when no user section is present.
 */
function primeUserScopeLines(output: string): string[] {
  const lines = output.replace(ANSI_SGR_RE, '').split('\n');
  const start = lines.findIndex((line) => /^\s*user\s+packages:\s*$/i.test(line));
  if (start === -1) return [];
  const end = lines.findIndex(
    (line, index) => index > start && /^\s*project\s+packages:\s*$/i.test(line),
  );
  return lines.slice(start + 1, end === -1 ? undefined : end);
}

/** True when the user-scope section of `package list` contains our source. */
function hasPrimeMaestriaPackage(output: string): boolean {
  return primeUserScopeLines(output).some((line) => PRIME_MAESTRIA_SOURCE_RE.test(line));
}

/**
 * Return the user-scope maestria source line when it is version-pinned (e.g.
 * `npm:@maestria/prime-agent@0.2.0`), or undefined when the registration is
 * unpinned or absent. Prime skips `package update` for pinned registrations,
 * so the update flow must fail with an accurate message instead of claiming an
 * update happened.
 */
function primeMaestriaPinnedSource(output: string): string | undefined {
  const source = primeUserScopeLines(output).find((line) => PRIME_MAESTRIA_SOURCE_RE.test(line));
  const trimmed = source?.trim();
  return trimmed && PRIME_MAESTRIA_PINNED_RE.test(trimmed) ? trimmed : undefined;
}

/**
 * Read a package.json file and return its `version` field using Node's
 * cross-platform fs/promises API rather than a POSIX `cat`, so installed paths
 * in either host-native or Windows format work on the matching host. A
 * Windows-style path on a POSIX host (or a missing file) fails to read and
 * falls back to 'unknown' in the caller. Fails with a CommandError to keep the
 * Effect error conventions used by the platform handlers.
 */
export function readPackageJsonVersion(
  packageJsonPath: string,
): Effect.Effect<string, CommandError> {
  return Effect.tryPromise({
    try: async () => {
      const { readFile } = await import('node:fs/promises');
      const pkg: { version?: string } = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
      return pkg.version ?? 'unknown';
    },
    catch: (error) =>
      new CommandError({
        command: `read ${packageJsonPath}`,
        message: String(error),
      }),
  });
}

/**
 * True when a path is absolute per either the host platform or Windows
 * conventions. `prime-agent package list` prints installed package paths in
 * the host's native format (`/home/user/...` on POSIX, `C:\Users\...` on
 * Windows), so the version lookup must accept both forms. On a POSIX host a
 * Windows-style path fails the subsequent fs read and falls back to 'unknown',
 * preserving prior behavior; on a Windows host the same read succeeds.
 */
function isPrimeAbsolutePath(p: string): boolean {
  return isAbsolute(p) || win32.isAbsolute(p);
}

/**
 * Read the installed version from `prime-agent package list` output. Only the
 * user-scope section is considered (project registrations are not managed
 * here), and only the path line printed directly below our source line is
 * used - later absolute paths belong to subsequent package entries. Falls back
 * to 'unknown' when the package is not listed, its entry has no installed
 * path, or the installed package.json cannot be read.
 */
function primeMaestriaInstalledVersion(output: string): Effect.Effect<string, CommandError> {
  const lines = primeUserScopeLines(output);
  const sourceIndex = lines.findIndex((line) => PRIME_MAESTRIA_SOURCE_RE.test(line));
  if (sourceIndex === -1) return Effect.succeed('unknown');

  const installedPath = lines[sourceIndex + 1]?.trim();
  if (!installedPath || !isPrimeAbsolutePath(installedPath)) return Effect.succeed('unknown');

  return readPackageJsonVersion(`${installedPath}/package.json`).pipe(
    Effect.catchCause(() => Effect.succeed('unknown')),
  );
}

/**
 * Create a fresh empty temporary working directory for Prime Agent package
 * commands. Prime's `package list`/`update` resolve project settings from the
 * current working directory, so every Prime command runs from an isolated
 * empty directory: only the user (global) scope can be read or written, and a
 * project's registrations are never scanned or modified. Fails closed with a
 * CommandError when the directory cannot be created, blocking the operation
 * before any Prime command runs.
 */
function primeTempCwd(): Effect.Effect<string, CommandError> {
  return Effect.tryPromise({
    try: async () => {
      const { mkdtemp } = await import('node:fs/promises');
      const { tmpdir } = await import('node:os');
      const { join } = await import('node:path');
      return await mkdtemp(join(tmpdir(), 'maestria-prime-'));
    },
    catch: (error) =>
      new CommandError({
        command: `create isolated temp cwd (${tmpdir()}/maestria-prime-*)`,
        message: `Failed to create an isolated working directory for Prime Agent: ${String(error)}`,
      }),
  });
}

/** Remove a Prime Agent temp cwd. Best-effort: cleanup failures are ignored. */
function removePrimeTempCwd(dir: string): Effect.Effect<void, never> {
  return Effect.tryPromise({
    try: async () => {
      const { rm } = await import('node:fs/promises');
      await rm(dir, { recursive: true, force: true });
    },
    catch: () => {},
  }).pipe(Effect.catchCause(() => Effect.void));
}

/**
 * Run a Prime Agent package command from a freshly created empty temporary
 * working directory. The directory is removed after the command completes on
 * both success and failure (Effect.ensuring), and temp-cwd creation failures
 * fail closed with a CommandError before the command runs.
 */
function withPrimeTempCwd<T>(
  effect: (cwd: string) => Effect.Effect<T, CommandError>,
): Effect.Effect<T, CommandError> {
  return Effect.gen(function* () {
    const cwd = yield* primeTempCwd();
    return yield* effect(cwd).pipe(Effect.ensuring(removePrimeTempCwd(cwd)));
  });
}

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
function primeUpdateSnapshot(): Effect.Effect<PlatformUpdateSnapshot, CommandError> {
  return Effect.gen(function* () {
    const list = yield* primePackageList;
    return {
      installedVersion: yield* primeMaestriaInstalledVersion(list),
      pinnedSource: primeMaestriaPinnedSource(list),
    };
  });
}

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
function primeUpdatePreflight(
  snapshot?: PlatformUpdateSnapshot,
): Effect.Effect<void, CommandError> {
  return Effect.gen(function* () {
    // A captured snapshot already knows the pinned state (pinned or not); only
    // a direct call without a snapshot (e.g. invoking the handler's update in
    // isolation) needs to read the registration state now.
    const pinnedSource =
      snapshot !== undefined
        ? snapshot.pinnedSource
        : yield* primePackageList.pipe(Effect.map(primeMaestriaPinnedSource));
    if (pinnedSource) {
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
  }).pipe(Effect.as(void 0));
}

const primeAgent: PlatformHandler = {
  id: 'prime-agent',
  label: 'Prime Agent',
  npmPackage: '@maestria/prime-agent',
  supportsVersionPinning: false,

  detect: commandExists('prime-agent'),

  isInstalled: primePackageList.pipe(
    Effect.map(hasPrimeMaestriaPackage),
    Effect.catchCause(() => Effect.succeed(false)),
  ),

  getInstalledVersion: primePackageList.pipe(
    Effect.flatMap(primeMaestriaInstalledVersion),
    Effect.catchCause(() => Effect.succeed('unknown')),
  ),

  getLatestVersion: npmViewVersion('@maestria/prime-agent'),

  // One per-update inspection shared by the version check, the preflight, and
  // the update step, so a normal update lists registrations once before and
  // once after the update command instead of once per step.
  captureUpdateSnapshot: primeUpdateSnapshot(),

  // Runs before the update command's "Already up to date" short-circuit so a
  // version-pinned registration is reported as an error even when the
  // installed version already equals the latest.
  preflightUpdate: (snapshot?: PlatformUpdateSnapshot) => primeUpdatePreflight(snapshot),

  install: withPrimeTempCwd((cwd) =>
    run('prime-agent', ['package', 'install', PRIME_MAESTRIA_SOURCE], 120_000, cwd),
  ).pipe(Effect.as(void 0)),

  update: (_version?: string, snapshot?: PlatformUpdateSnapshot) =>
    Effect.gen(function* () {
      // Prime skips `package update` for version-pinned registrations. Detect
      // that state up front (from the per-update snapshot when available) and
      // fail with an accurate message rather than reporting a fake success
      // (which would also invalidate the version cache for a package that was
      // not updated).
      yield* primeUpdatePreflight(snapshot);
      yield* withPrimeTempCwd((cwd) =>
        run('prime-agent', ['package', 'update', PRIME_MAESTRIA_SOURCE], 120_000, cwd),
      );
    }).pipe(Effect.as(void 0)),

  uninstall: withPrimeTempCwd((cwd) =>
    run('prime-agent', ['package', 'remove', PRIME_MAESTRIA_SOURCE], 60_000, cwd),
  ).pipe(Effect.as(void 0)),
};

const kimiCode: PlatformHandler = {
  id: 'kimi-code',
  label: 'Kimi Code',
  npmPackage: '@maestria/kimi-code',

  detect: commandExists('kimi').pipe(
    Effect.catchCause(() =>
      run('ls', [`${homedir()}/.kimi-code/AGENTS.md`], 2_000).pipe(
        Effect.map(() => true),
        Effect.catchCause(() => Effect.succeed(false)),
      ),
    ),
  ),

  isInstalled: run('ls', [`${homedir()}/.kimi-code/AGENTS.md`]).pipe(
    Effect.map(() => true),
    Effect.catchCause(() => Effect.succeed(false)),
  ),

  getInstalledVersion: run('cat', [
    `${homedir()}/.kimi-code/plugins/managed/maestria/kimi.plugin.json`,
  ]).pipe(
    Effect.map((out: string) => {
      try {
        return JSON.parse(out).version ?? 'unknown';
      } catch {
        return 'unknown';
      }
    }),
    Effect.catchCause(() => Effect.succeed('unknown')),
  ),

  getLatestVersion: npmViewVersion('@maestria/kimi-code'),

  install: Effect.gen(function* () {
    yield* Effect.tryPromise({
      try: async () => {
        const { mkdir } = await import('node:fs/promises');
        await mkdir(`${homedir()}/.kimi-code/plugins/managed/maestria`, { recursive: true });
      },
      catch: (error) =>
        new CommandError({
          command: `mkdir -p ${homedir()}/.kimi-code/plugins/managed/maestria`,
          message: String(error),
        }),
    });
    yield* installNpmTarball(
      '@maestria/kimi-code',
      `${homedir()}/.kimi-code/plugins/managed/maestria`,
      {
        copyFrom: 'rules/AGENTS.md',
        copyTo: `${homedir()}/.kimi-code/AGENTS.md`,
      },
    );
  }).pipe(Effect.as(void 0)),

  update: (version?: string) =>
    Effect.gen(function* () {
      const tag = version ?? 'latest';
      yield* installNpmTarball(
        '@maestria/kimi-code',
        `${homedir()}/.kimi-code/plugins/managed/maestria`,
        {
          tag,
          copyFrom: 'rules/AGENTS.md',
          copyTo: `${homedir()}/.kimi-code/AGENTS.md`,
        },
      );
      yield* invalidateVersionCache('@maestria/kimi-code').pipe(
        Effect.catchCause(() => Effect.void),
      );
    }).pipe(Effect.as(void 0)),

  uninstall: Effect.gen(function* () {
    yield* sh(
      `rm -rf "${homedir()}/.kimi-code/plugins/managed/maestria" "${homedir()}/.kimi-code/AGENTS.md"`,
      15_000,
    );
  }).pipe(Effect.as(void 0)),
};

const hermes: PlatformHandler = {
  id: 'hermes',
  label: 'Hermes',
  // No npmPackage - distributed via hermes plugins install (git-based)

  detect: commandExists('hermes'),

  isInstalled: run('ls', [`${homedir()}/.hermes/plugins/maestria-hermes/plugin.yaml`], 5_000).pipe(
    Effect.map(() => true),
    Effect.catchCause(() => Effect.succeed(false)),
  ),

  getInstalledVersion: run('cat', [
    `${homedir()}/.hermes/plugins/maestria-hermes/plugin.yaml`,
  ]).pipe(
    Effect.map((out: string) => {
      const match = out.match(/^version:\s*["']?(.+?)["']?\s*$/m);
      return match?.[1] ?? 'unknown';
    }),
    Effect.catchCause(() => Effect.succeed('unknown')),
  ),

  getLatestVersion: Effect.succeed('see GitHub releases'),

  install: Effect.gen(function* () {
    yield* sh(
      'hermes plugins install agustinusnathaniel/maestria/packages/hermes --enable',
      120_000,
    );
  }).pipe(Effect.as(void 0)),

  update: (_version?: string) =>
    Effect.gen(function* () {
      if (_version) {
        console.log(
          `  ${picocolors.yellow('⚠')} Version pinning is not supported for git-based Hermes plugins. ` +
            `Updating to latest from git.`,
        );
      }
      yield* sh('hermes plugins update maestria-hermes', 60_000);
    }),

  uninstall: Effect.gen(function* () {
    yield* sh('hermes plugins remove maestria-hermes', 15_000);
  }).pipe(Effect.as(void 0)),
};

const CURSOR_PLUGIN_DIR = `${homedir()}/.cursor/plugins/local/maestria`;
const CURSOR_PLUGIN_JSON = `${CURSOR_PLUGIN_DIR}/.cursor-plugin/plugin.json`;

const cursor: PlatformHandler = {
  id: 'cursor',
  label: 'Cursor',
  npmPackage: '@maestria/cursor',

  detect: commandExists('agent').pipe(
    Effect.catchCause(() =>
      run('ls', [`${homedir()}/.cursor`], 2_000).pipe(
        Effect.map(() => true),
        Effect.catchCause(() => Effect.succeed(false)),
      ),
    ),
  ),

  isInstalled: run('ls', [CURSOR_PLUGIN_JSON], 2_000).pipe(
    Effect.map(() => true),
    Effect.catchCause(() => Effect.succeed(false)),
  ),

  getInstalledVersion: run('cat', [`${CURSOR_PLUGIN_DIR}/package.json`]).pipe(
    Effect.map((out: string) => {
      try {
        const pkg: { version?: string } = JSON.parse(out);
        return pkg.version ?? 'unknown';
      } catch {
        return 'unknown';
      }
    }),
    Effect.catchCause(() => Effect.succeed('unknown')),
  ),

  getLatestVersion: npmViewVersion('@maestria/cursor'),

  install: Effect.gen(function* () {
    yield* Effect.tryPromise({
      try: async () => {
        const { mkdir } = await import('node:fs/promises');
        await mkdir(`${homedir()}/.cursor/plugins/local`, { recursive: true });
      },
      catch: (error) =>
        new CommandError({
          command: `mkdir -p ${homedir()}/.cursor/plugins/local`,
          message: String(error),
        }),
    });
    yield* installNpmTarball('@maestria/cursor', CURSOR_PLUGIN_DIR);
  }).pipe(Effect.as(void 0)),

  update: (version?: string) =>
    Effect.gen(function* () {
      const tag = version ?? 'latest';
      yield* installNpmTarball('@maestria/cursor', CURSOR_PLUGIN_DIR, { tag });
      // Invalidate version cache so npmViewVersion doesn't return stale data
      yield* invalidateVersionCache('@maestria/cursor').pipe(Effect.catchCause(() => Effect.void));
    }).pipe(Effect.as(void 0)),

  uninstall: Effect.gen(function* () {
    yield* sh(`rm -rf "${CURSOR_PLUGIN_DIR}"`, 15_000);
  }).pipe(Effect.as(void 0)),
};

const omp: PlatformHandler = {
  id: 'omp',
  label: 'Oh My Pi',
  npmPackage: '@maestria/omp',

  detect: commandExists('omp'),

  isInstalled: run(
    'ls',
    [`${homedir()}/.omp/plugins/node_modules/@maestria/omp/package.json`],
    2_000,
  ).pipe(
    Effect.map(() => true),
    Effect.catchCause(() => Effect.succeed(false)),
  ),

  getInstalledVersion: run('cat', [
    `${homedir()}/.omp/plugins/node_modules/@maestria/omp/package.json`,
  ]).pipe(
    Effect.map((out: string) => {
      try {
        const pkg: { version?: string } = JSON.parse(out);
        return pkg.version ?? 'unknown';
      } catch {
        return 'unknown';
      }
    }),
    Effect.catchCause(() => Effect.succeed('unknown')),
  ),

  getLatestVersion: npmViewVersion('@maestria/omp'),

  install: Effect.gen(function* () {
    // omp has built-in task dispatch - no subagent prerequisite needed
    yield* run('omp', ['plugin', 'install', '@maestria/omp'], 120_000);
  }).pipe(Effect.as(void 0)),

  update: (version?: string) =>
    Effect.gen(function* () {
      const tagged = version ? `@maestria/omp@${version}` : '@maestria/omp@latest';
      yield* run('omp', ['plugin', 'install', tagged], 120_000);
    }),

  uninstall: run('omp', ['plugin', 'uninstall', '@maestria/omp']).pipe(Effect.as(void 0)),
};

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
];

export function getPlatform(id: string): PlatformHandler | undefined {
  return platforms.find((p) => p.id === id);
}
