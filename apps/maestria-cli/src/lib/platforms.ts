import { Effect } from 'effect';
import { homedir } from 'os';
import picocolors from 'picocolors';
import type { PlatformStatus, PlatformResult } from '../types.js';
import { run, commandExists, npmViewVersion, CommandError } from './shell.js';

// ── Platform definitions ─────────────────────────────

export interface PlatformHandler {
  readonly id: string;
  readonly label: string;
  readonly npmPackage?: string;
  readonly detect: Effect.Effect<boolean, never>;
  readonly isInstalled: Effect.Effect<boolean, never>;
  readonly getInstalledVersion: Effect.Effect<string, CommandError>;
  readonly getLatestVersion: Effect.Effect<string, CommandError>;
  readonly install: Effect.Effect<void, CommandError>;
  readonly update: Effect.Effect<void, CommandError>;
  readonly uninstall: Effect.Effect<void, CommandError>;
}

const opencode: PlatformHandler = {
  id: 'opencode',
  label: 'OpenCode',
  npmPackage: '@maestria/opencode',

  detect: commandExists('opencode'),

  isInstalled: run('opencode', ['config', 'get', 'plugins']).pipe(
    Effect.map((out: string) => out.includes('@maestria/opencode')),
    Effect.catchCause(() => Effect.succeed(false)),
  ),

  getInstalledVersion: run('cat', [
    `${homedir()}/.cache/opencode/packages/@maestria/opencode/package.json`,
  ]).pipe(
    Effect.map((out: string) => {
      try {
        const pkg: { version?: string } = JSON.parse(out);
        return pkg.version ?? 'unknown';
      } catch {
        return 'unknown';
      }
    }),
  ),

  getLatestVersion: npmViewVersion('@maestria/opencode'),

  install: run('opencode', ['plugin', '@maestria/opencode@latest']).pipe(Effect.as(void 0)),

  update: Effect.gen(function* () {
    const plugins = yield* run('opencode', ['config', 'get', 'plugins']);
    const isGlobal = plugins.includes('@maestria/opencode');
    if (isGlobal) {
      yield* run('opencode', ['plugin', '@maestria/opencode@latest', '-g', '--force']);
    } else {
      yield* run('opencode', ['plugin', '@maestria/opencode@latest', '--force']);
    }
  }).pipe(
    Effect.catchTag(
      'CommandError',
      (e: CommandError) => Effect.fail(e) as Effect.Effect<never, CommandError>,
    ),
  ),

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

  isInstalled: run('pi', ['extensions', 'list']).pipe(
    Effect.map((out: string) => out.includes('@maestria/pi')),
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

  update: run('pi', ['install', 'npm:@maestria/pi@latest']).pipe(Effect.as(void 0)),

  uninstall: run('pi', ['uninstall', '@maestria/pi']).pipe(Effect.as(void 0)),
};

const kimiCode: PlatformHandler = {
  id: 'kimi-code',
  label: 'Kimi Code',

  detect: commandExists('kimi').pipe(
    Effect.catchCause(() =>
      run('ls', [`${homedir()}/.kimi-code/AGENTS.md`]).pipe(
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
          return '';
        }),
      ),
    );
  }).pipe(
    Effect.catchTag(
      'CommandError',
      (e: CommandError) => Effect.fail(e) as Effect.Effect<never, CommandError>,
    ),
  ),

  update: run('kimi', [
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
