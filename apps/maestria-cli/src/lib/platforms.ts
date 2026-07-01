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

  getInstalledVersion: run('cat', [
    `${homedir()}/.cache/opencode/packages/@maestria/opencode@latest/node_modules/@maestria/opencode/package.json`,
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

  getLatestVersion: npmViewVersion('@maestria/opencode'),

  install: Effect.gen(function* () {
    // Clear cache to ensure fresh install from npm
    yield* sh(`rm -rf ${homedir()}/.cache/opencode/packages/@maestria/opencode*`);
    // Install globally by default — install is a setup command, not per-project
    yield* run('opencode', ['plugin', '@maestria/opencode@latest', '-g']);
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
    [`${homedir()}/.local/share/pi/extensions/node_modules/@maestria/pi/package.json`],
    2_000,
  ).pipe(
    Effect.map(() => true),
    Effect.catchCause(() => Effect.succeed(false)),
  ),

  getInstalledVersion: run('cat', [
    `${homedir()}/.local/share/pi/extensions/node_modules/@maestria/pi/package.json`,
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

  install: run('pi', ['install', 'npm:@maestria/pi']).pipe(Effect.as(void 0)),

  update: (version?: string) => {
    const tagged = version ? `npm:@maestria/pi@${version}` : 'npm:@maestria/pi@latest';
    return run('pi', ['install', tagged]).pipe(Effect.as(void 0));
  },

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
    yield* run('kimi', [
      'plugins',
      'install',
      'https://github.com/agustinusnathaniel/maestria/tree/release/kimi-code',
    ]);
    yield* run('cp', [
      `${homedir()}/.local/share/kimi/plugins/maestria/rules/AGENTS.md`,
      `${homedir()}/.kimi-code/AGENTS.md`,
    ]).pipe(
      Effect.catchTag('CommandError', () =>
        Effect.sync(() => {
          console.log(
            `\n  ${picocolors.yellow('⚠')} Plugin installed but rules copy failed.\n` +
              `  Manually copy: cp "${homedir()}/.local/share/kimi/plugins/maestria/rules/AGENTS.md" "${homedir()}/.kimi-code/AGENTS.md"\n`,
          );
        }),
      ),
    );
  }),

  update: (_version?: string) =>
    run('kimi', [
      'plugins',
      'install',
      'https://github.com/agustinusnathaniel/maestria/tree/release/kimi-code',
    ]).pipe(Effect.as(void 0)),

  uninstall: run('kimi', ['plugins', 'uninstall', 'maestria']).pipe(
    Effect.andThen(run('rm', [`${homedir()}/.kimi-code/AGENTS.md`])),
    Effect.as(void 0),
  ),
};

// ── Registry ─────────────────────────────────────────
export const platforms: readonly PlatformHandler[] = [opencode, pi, kimiCode];

export function getPlatform(id: string): PlatformHandler | undefined {
  return platforms.find((p) => p.id === id);
}
