import { Effect } from 'effect';
import { homedir } from 'os';
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
    yield* sh(
      `rm -rf /tmp/maestria-kimi-code* "${homedir()}/.kimi-code/plugins/managed/maestria"`,
      15_000,
    );
    yield* sh(
      `mkdir -p "${homedir()}/.kimi-code/plugins/managed/maestria" && ` +
        `npm pack @maestria/kimi-code@latest --pack-destination /tmp && ` +
        `tar -xzf /tmp/maestria-kimi-code-*.tgz -C "${homedir()}/.kimi-code/plugins/managed/maestria" --strip-components=1 && ` +
        `cp "${homedir()}/.kimi-code/plugins/managed/maestria/rules/AGENTS.md" "${homedir()}/.kimi-code/AGENTS.md" && ` +
        `rm -f /tmp/maestria-kimi-code-*.tgz`,
      120_000,
    );
  }).pipe(Effect.as(void 0)),

  update: (version?: string) =>
    Effect.gen(function* () {
      const tag = version ?? 'latest';
      yield* sh(
        `rm -rf /tmp/maestria-kimi-code* "${homedir()}/.kimi-code/plugins/managed/maestria"`,
        15_000,
      );
      yield* sh(
        `mkdir -p "${homedir()}/.kimi-code/plugins/managed/maestria" && ` +
          `npm pack @maestria/kimi-code@${tag} --pack-destination /tmp && ` +
          `tar -xzf /tmp/maestria-kimi-code-*.tgz -C "${homedir()}/.kimi-code/plugins/managed/maestria" --strip-components=1 && ` +
          `cp "${homedir()}/.kimi-code/plugins/managed/maestria/rules/AGENTS.md" "${homedir()}/.kimi-code/AGENTS.md" && ` +
          `rm -f /tmp/maestria-kimi-code-*.tgz`,
        120_000,
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
    yield* sh(`rm -rf "${CURSOR_PLUGIN_DIR}"`, 15_000);
    yield* sh(
      `npm pack @maestria/cursor@latest --pack-destination /tmp && ` +
        `mkdir -p "${CURSOR_PLUGIN_DIR}" && ` +
        `tar -xzf /tmp/maestria-cursor-*.tgz -C "${CURSOR_PLUGIN_DIR}" --strip-components=1 && ` +
        `rm -f /tmp/maestria-cursor-*.tgz`,
      120_000,
    );
  }).pipe(Effect.as(void 0)),

  update: (version?: string) =>
    Effect.gen(function* () {
      const tag = version ?? 'latest';
      yield* sh(`rm -rf "${CURSOR_PLUGIN_DIR}"`, 15_000);
      yield* sh(
        `npm pack @maestria/cursor@${tag} --pack-destination /tmp && ` +
          `mkdir -p "${CURSOR_PLUGIN_DIR}" && ` +
          `tar -xzf /tmp/maestria-cursor-*.tgz -C "${CURSOR_PLUGIN_DIR}" --strip-components=1 && ` +
          `rm -f /tmp/maestria-cursor-*.tgz`,
        120_000,
      );
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
    // omp has built-in task dispatch — no subagent prerequisite needed
    yield* run('omp', ['install', 'npm:@maestria/omp'], 120_000);
  }).pipe(Effect.as(void 0)),

  update: (version?: string) =>
    Effect.gen(function* () {
      const tagged = version ? `npm:@maestria/omp@${version}` : 'npm:@maestria/omp@latest';
      yield* run('omp', ['install', tagged], 120_000);
    }),

  uninstall: run('omp', ['uninstall', '@maestria/omp']).pipe(Effect.as(void 0)),
};

// ── Registry ─────────────────────────────────────────
export const platforms: readonly PlatformHandler[] = [opencode, pi, kimiCode, hermes, cursor, omp];

export function getPlatform(id: string): PlatformHandler | undefined {
  return platforms.find((p) => p.id === id);
}
