import { Effect } from 'effect';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vite-plus/test';

import type { PlatformHandler } from '@/lib/platforms.js';
import { installOne, uninstallOne, updateOne } from '@/lib/platform-transaction.js';
import { CommandError } from '@/lib/shell.js';

const commandError = (command: string, message: string): CommandError =>
  new CommandError({ command, message });

const makePlatform = (overrides: Partial<PlatformHandler> = {}): PlatformHandler => ({
  detect: Effect.succeed(true),
  getInstalledVersion: Effect.succeed('0.1.0'),
  getLatestVersion: Effect.succeed('0.2.0'),
  id: 'opencode',
  install: Effect.void,
  isInstalled: Effect.succeed(true),
  label: 'OpenCode',
  uninstall: Effect.void,
  update: () => Effect.void,
  ...overrides,
});

describe('installOne', () => {
  it('reports a successful install with the platform identity', async () => {
    const result = await Effect.runPromise(installOne(makePlatform(), true));

    expect(result).toEqual({
      id: 'opencode',
      label: 'OpenCode',
      message: 'Installed',
      ok: true,
    });
  });

  it('reports the CommandError message when the install fails', async () => {
    const result = await Effect.runPromise(
      installOne(
        makePlatform({ install: Effect.fail(commandError('opencode install', 'install failed')) }),
        true,
      ),
    );

    expect(result).toEqual({
      id: 'opencode',
      label: 'OpenCode',
      message: 'install failed',
      ok: false,
    });
  });
});

describe('uninstallOne', () => {
  it('reports a successful uninstall with the platform identity', async () => {
    const result = await Effect.runPromise(uninstallOne(makePlatform(), true));

    expect(result).toEqual({
      id: 'opencode',
      label: 'OpenCode',
      message: 'Uninstalled',
      ok: true,
    });
  });

  it('reports the CommandError message when the uninstall fails', async () => {
    const result = await Effect.runPromise(
      uninstallOne(
        makePlatform({
          uninstall: Effect.fail(commandError('opencode uninstall', 'uninstall failed')),
        }),
        true,
      ),
    );

    expect(result).toEqual({
      id: 'opencode',
      label: 'OpenCode',
      message: 'uninstall failed',
      ok: false,
    });
  });
});

describe('updateOne', () => {
  it('refuses a pinned update when the platform does not support version pinning', async () => {
    const updates: (string | undefined)[] = [];
    const platform = makePlatform({
      supportsVersionPinning: false,
      update: (version) =>
        Effect.sync(() => {
          updates.push(version);
        }),
    });

    const result = await Effect.runPromise(updateOne(platform, true, '0.2.0'));

    expect(result).toEqual({
      id: 'opencode',
      label: 'OpenCode',
      message:
        'Version pinning is not supported for OpenCode; updating without --version is required.',
      ok: false,
    });
    expect(updates).toHaveLength(0);
  });

  it('reports a snapshot capture error instead of updating blind', async () => {
    const result = await Effect.runPromise(
      updateOne(
        makePlatform({
          captureUpdateSnapshot: Effect.fail(commandError('snapshot', 'snapshot failed')),
        }),
        true,
      ),
    );

    expect(result).toEqual({
      id: 'opencode',
      label: 'OpenCode',
      message: 'snapshot failed',
      ok: false,
    });
  });

  it('short-circuits when the installed version already matches the target', async () => {
    const updates: string[] = [];
    const platform = makePlatform({
      getInstalledVersion: Effect.succeed('0.2.0'),
      getLatestVersion: Effect.succeed('0.2.0'),
      update: () =>
        Effect.sync(() => {
          updates.push('update');
        }),
    });

    const result = await Effect.runPromise(updateOne(platform, true));

    expect(result).toEqual({
      id: 'opencode',
      label: 'OpenCode',
      message: 'Already up to date',
      nextVersion: '0.2.0',
      ok: true,
      prevVersion: '0.2.0',
    });
    expect(updates).toHaveLength(0);
  });

  it('skips an implicit update when the installed version is newer than the latest', async () => {
    const updates: string[] = [];
    const platform = makePlatform({
      getInstalledVersion: Effect.succeed('0.3.0'),
      getLatestVersion: Effect.succeed('0.2.0'),
      update: () =>
        Effect.sync(() => {
          updates.push('update');
        }),
    });

    const result = await Effect.runPromise(updateOne(platform, true));

    expect(result).toEqual({
      id: 'opencode',
      label: 'OpenCode',
      message: 'Installed v0.3.0 is newer than latest v0.2.0; skipping (use --version to pin)',
      nextVersion: '0.3.0',
      ok: true,
      prevVersion: '0.3.0',
    });
    expect(updates).toHaveLength(0);
  });

  it('reports a preflight failure without running the update', async () => {
    const updates: string[] = [];
    const platform = makePlatform({
      preflightUpdate: () => Effect.fail(commandError('preflight', 'preflight blocked')),
      update: () =>
        Effect.sync(() => {
          updates.push('update');
        }),
    });

    const result = await Effect.runPromise(updateOne(platform, true));

    expect(result).toEqual({
      id: 'opencode',
      label: 'OpenCode',
      message: 'preflight blocked',
      ok: false,
    });
    expect(updates).toHaveLength(0);
  });

  it('reports the update command failure', async () => {
    const result = await Effect.runPromise(
      updateOne(
        makePlatform({
          update: () => Effect.fail(commandError('opencode update', 'update failed')),
        }),
        true,
      ),
    );

    expect(result).toEqual({
      id: 'opencode',
      label: 'OpenCode',
      message: 'update failed',
      ok: false,
    });
  });

  it('updates and invalidates the cached version for a package-backed platform', async () => {
    const cacheRoot = await mkdtemp(path.join(tmpdir(), 'maestria-transaction-'));
    const previousCacheHome = process.env.XDG_CACHE_HOME;
    process.env.XDG_CACHE_HOME = cacheRoot;
    try {
      const cacheFile = path.join(cacheRoot, 'maestria', 'versions.json');
      await mkdir(path.dirname(cacheFile), { recursive: true });
      await writeFile(
        cacheFile,
        JSON.stringify({
          '@maestria/opencode': { version: '0.1.0' },
          '@maestria/untouched': { version: '9.9.9' },
        }),
      );
      let installedVersionReads = 0;
      const platform = makePlatform({
        getInstalledVersion: Effect.sync(() => {
          installedVersionReads += 1;
          return installedVersionReads === 1 ? '0.1.0' : '0.2.0';
        }),
        npmPackage: '@maestria/opencode',
      });

      const result = await Effect.runPromise(updateOne(platform, true));

      expect(result).toEqual({
        id: 'opencode',
        label: 'OpenCode',
        message: 'Updated',
        nextVersion: '0.2.0',
        ok: true,
        prevVersion: '0.1.0',
      });
      const cacheText = await readFile(cacheFile, 'utf-8');
      expect(cacheText).not.toContain('@maestria/opencode');
      expect(cacheText).toContain('@maestria/untouched');
    } finally {
      if (previousCacheHome === undefined) {
        delete process.env.XDG_CACHE_HOME;
      } else {
        process.env.XDG_CACHE_HOME = previousCacheHome;
      }
      await rm(cacheRoot, { force: true, recursive: true });
    }
  });
});
