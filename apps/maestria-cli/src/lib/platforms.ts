import { Effect } from 'effect';
import { homedir } from 'os';
import picocolors from 'picocolors';

import { run, sh, commandExists, npmViewVersion, CommandError } from '@/lib/shell.js';

// ── Shared helpers ───────────────────────────────────

/** Read OpenCode config file, trying .jsonc first then .json */
function readOpenCodeConfig(): Effect.Effect<string, CommandError> {
  const jsoncPath = `${homedir()}/.config/opencode/opencode.jsonc`;
  const jsonPath = `${homedir()}/.config/opencode/opencode.json`;
  return run('cat', [jsoncPath], 5_000).pipe(
    Effect.catchCause(() => run('cat', [jsonPath], 5_000)),
  );
}

// ── Platform definitions ─────────────────────────────

export interface PlatformHandler {
  readonly id: string;
  readonly label: string;
  readonly npmPackage?: string;
  readonly detect: Effect.Effect<boolean, never>;
  readonly isInstalled: Effect.Effect<boolean, never>;
  readonly getInstalledVersion: Effect.Effect<string, CommandError>;
  readonly getLatestVersion: Effect.Effect<string, never>;
  readonly install: Effect.Effect<void, CommandError>;
  readonly update: (version?: string) => Effect.Effect<void, CommandError>;
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

  uninstall: run('pi', ['uninstall', '@maestria/pi']).pipe(Effect.as(void 0)),
};

const kimiCode: PlatformHandler = {
  id: 'kimi-code',
  label: 'Kimi Code',

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

  getInstalledVersion: run('cat', [`${homedir()}/.kimi-code/AGENTS.md`]).pipe(
    Effect.map((content: string) => {
      const match = content.match(/@maestria\/kimi-code@(\S+)/);
      return match?.[1] ?? 'unknown';
    }),
    Effect.catchCause(() => Effect.succeed('unknown')),
  ),

  getLatestVersion: Effect.succeed('see GitHub releases'),

  install: Effect.gen(function* () {
    const home = homedir();
    const kimiHome = `${home}/.kimi-code`;
    const managedDir = `${kimiHome}/plugins/managed/maestria`;
    const pluginsDir = `${kimiHome}/plugins`;
    const installUrl = 'https://github.com/agustinusnathaniel/maestria/tree/release/kimi-code';

    // Create managed directory
    yield* Effect.tryPromise({
      try: async () => {
        const { mkdir } = await import('node:fs/promises');
        await mkdir(managedDir, { recursive: true });
      },
      catch: (error) =>
        new CommandError({
          command: `mkdir -p ${managedDir}`,
          message: String(error),
        }),
    });

    // Download and extract plugin from GitHub using codeload
    yield* sh(
      `curl -sL "https://codeload.github.com/agustinusnathaniel/maestria/tar.gz/release/kimi-code" | tar xz -C /tmp`,
      60_000,
    );

    const tmpExtractDir = '/tmp/maestria-release-kimi-code';
    yield* sh(`cp -r "${tmpExtractDir}/packages/kimi-code/"* "${managedDir}/"`);
    yield* sh(`rm -rf "${tmpExtractDir}"`);

    // Copy AGENTS.md rules
    yield* run('cp', [`${managedDir}/rules/AGENTS.md`, `${kimiHome}/AGENTS.md`]).pipe(
      Effect.catchTag('CommandError', () =>
        Effect.sync(() => {
          console.log(
            `  ${picocolors.yellow('⚠')} Plugin files copied but rules/AGENTS.md not found.\n` +
              `  The plugin is installed. Restarting Kimi Code should pick it up.\n`,
          );
        }),
      ),
    );

    // Write installed.json
    const installed = yield* readInstalledJsonEffect(pluginsDir);
    installed.plugins = installed.plugins.filter((p) => p.id !== 'maestria');
    installed.plugins.push({
      id: 'maestria',
      root: managedDir,
      source: 'github',
      enabled: true,
      installedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      originalSource: installUrl,
      github: {
        owner: 'agustinusnathaniel',
        repo: 'maestria',
        ref: { kind: 'branch', value: 'release/kimi-code' },
      },
    });
    yield* writeInstalledJsonEffect(pluginsDir, installed);
  }).pipe(Effect.as(void 0)),

  update: (_version?: string) =>
    Effect.gen(function* () {
      const home = homedir();
      const kimiHome = `${home}/.kimi-code`;
      const managedDir = `${kimiHome}/plugins/managed/maestria`;
      const pluginsDir = `${kimiHome}/plugins`;
      const installUrl = 'https://github.com/agustinusnathaniel/maestria/tree/release/kimi-code';

      // Read existing installed.json to preserve installedAt
      const installed = yield* readInstalledJsonEffect(pluginsDir);
      const existing = installed.plugins.find((p) => p.id === 'maestria');
      const installedAt = existing?.installedAt ?? new Date().toISOString();

      // Create managed directory
      yield* Effect.tryPromise({
        try: async () => {
          const { mkdir } = await import('node:fs/promises');
          await mkdir(managedDir, { recursive: true });
        },
        catch: (error) =>
          new CommandError({
            command: `mkdir -p ${managedDir}`,
            message: String(error),
          }),
      });

      // Download and extract plugin from GitHub using codeload
      yield* sh(
        `curl -sL "https://codeload.github.com/agustinusnathaniel/maestria/tar.gz/release/kimi-code" | tar xz -C /tmp`,
        60_000,
      );

      const tmpExtractDir = '/tmp/maestria-release-kimi-code';
      yield* sh(`cp -r "${tmpExtractDir}/packages/kimi-code/"* "${managedDir}/"`);
      yield* sh(`rm -rf "${tmpExtractDir}"`);

      // Copy AGENTS.md rules
      yield* run('cp', [`${managedDir}/rules/AGENTS.md`, `${kimiHome}/AGENTS.md`]).pipe(
        Effect.catchTag('CommandError', () =>
          Effect.sync(() => {
            console.log(
              `  ${picocolors.yellow('⚠')} Plugin files copied but rules/AGENTS.md not found.\n` +
                `  The plugin is updated. Restarting Kimi Code should pick it up.\n`,
            );
          }),
        ),
      );

      // Update installed.json
      installed.plugins = installed.plugins.filter((p) => p.id !== 'maestria');
      installed.plugins.push({
        id: 'maestria',
        root: managedDir,
        source: 'github',
        enabled: true,
        installedAt,
        updatedAt: new Date().toISOString(),
        originalSource: installUrl,
        github: {
          owner: 'agustinusnathaniel',
          repo: 'maestria',
          ref: { kind: 'branch', value: 'release/kimi-code' },
        },
      });
      yield* writeInstalledJsonEffect(pluginsDir, installed);
    }).pipe(Effect.as(void 0)),

  uninstall: Effect.gen(function* () {
    const home = homedir();
    const kimiHome = `${home}/.kimi-code`;
    const pluginsDir = `${kimiHome}/plugins`;
    const managedDir = `${kimiHome}/plugins/managed/maestria`;

    // Remove from installed.json
    const installed = yield* readInstalledJsonEffect(pluginsDir);
    installed.plugins = installed.plugins.filter((p) => p.id !== 'maestria');
    yield* writeInstalledJsonEffect(pluginsDir, installed);

    // Remove managed directory
    yield* sh(`rm -rf "${managedDir}"`);

    // Remove AGENTS.md
    yield* run('rm', ['-f', `${kimiHome}/AGENTS.md`]).pipe(Effect.catchCause(() => Effect.void));
  }).pipe(Effect.as(void 0)),
};

// ── Kimi Code helpers ─────────────────────────────────

interface InstalledRecord {
  id: string;
  root: string;
  source: string;
  enabled: boolean;
  installedAt: string;
  updatedAt?: string;
  originalSource?: string;
  capabilities?: Record<string, unknown>;
  github?: {
    owner: string;
    repo: string;
    ref: { kind: string; value: string };
    installedSha?: string;
  };
}

interface InstalledFile {
  version: 1;
  plugins: InstalledRecord[];
}

async function readInstalledJson(pluginsDir: string): Promise<InstalledFile> {
  try {
    const { readFile } = await import('node:fs/promises');
    const content = await readFile(`${pluginsDir}/installed.json`, 'utf-8');
    return JSON.parse(content) as InstalledFile;
  } catch {
    return { version: 1, plugins: [] };
  }
}

async function writeInstalledJson(pluginsDir: string, data: InstalledFile): Promise<void> {
  const { mkdir, writeFile, rename } = await import('node:fs/promises');
  await mkdir(pluginsDir, { recursive: true });
  const tmpPath = `${pluginsDir}/installed.json.tmp`;
  const finalPath = `${pluginsDir}/installed.json`;
  await writeFile(tmpPath, JSON.stringify(data, null, 2) + '\n');
  await rename(tmpPath, finalPath);
}

const readInstalledJsonEffect = (pluginsDir: string): Effect.Effect<InstalledFile, never> =>
  Effect.tryPromise(() => readInstalledJson(pluginsDir)).pipe(
    Effect.catchCause(() =>
      Effect.succeed({ version: 1 as const, plugins: [] as InstalledRecord[] }),
    ),
  );

const writeInstalledJsonEffect = (
  pluginsDir: string,
  data: InstalledFile,
): Effect.Effect<void, never> =>
  Effect.tryPromise(() => writeInstalledJson(pluginsDir, data)).pipe(
    Effect.catchCause(() => Effect.void),
  );

const hermes: PlatformHandler = {
  id: 'hermes',
  label: 'Hermes',
  // No npmPackage — distributed via hermes plugins install (git-based)

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

// ── Registry ─────────────────────────────────────────
export const platforms: readonly PlatformHandler[] = [opencode, pi, kimiCode, hermes];

export function getPlatform(id: string): PlatformHandler | undefined {
  return platforms.find((p) => p.id === id);
}
