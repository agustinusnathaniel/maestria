import { Effect } from 'effect';
import type * as FsPromises from 'node:fs/promises';
import { describe, expect, it, vi } from 'vite-plus/test';

import { updateOne } from '@/lib/platform-transaction.js';
import { getPlatform } from '@/lib/platforms.js';
import * as shell from '@/lib/shell.js';

// Stub the fs read plus the version-cache write so host version lookups run
// deterministically without touching the real filesystem.
const fsMocks = vi.hoisted(() => ({
  mkdtemp: vi.fn((prefix: string) => `${prefix}test-dir`),
  readFile: vi.fn((_path: string) => JSON.stringify({ version: '0.2.0' })),
  rm: vi.fn(async () => {}),
}));

vi.mock('@/lib/shell.js', async (importOriginal) => {
  const actual = await importOriginal<typeof shell>();
  return {
    ...actual,
    run: vi.fn((_cmd: string, _args: string[], _timeoutMs?: number) => Effect.succeed('')),
    sh: vi.fn((_command: string, _timeoutMs?: number) => Effect.succeed('')),
  };
});

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof FsPromises>();
  return {
    ...actual,
    mkdir: vi.fn(async () => {}),
    mkdtemp: fsMocks.mkdtemp,
    readFile: fsMocks.readFile,
    rm: fsMocks.rm,
    writeFile: vi.fn(async () => {}),
  };
});

const requirePlatform = (id: string): NonNullable<ReturnType<typeof getPlatform>> => {
  const platform = getPlatform(id);
  if (platform === undefined) {
    throw new Error(`Platform not found: ${id}`);
  }
  return platform;
};

// An implicit update (no --version) must never downgrade an install that is
// ahead of the registry. An explicit -V pin is honored verbatim.
describe('update command - no silent downgrade', () => {
  it('skips an implicit update when the installed version is newer than latest', async () => {
    vi.clearAllMocks();
    vi.mocked(shell.run).mockImplementation(() => Effect.succeed(''));

    const newerPlatform = {
      ...requirePlatform('opencode'),
      getInstalledVersion: Effect.succeed('0.99.0'),
      getLatestVersion: Effect.succeed('0.2.0'),
    };
    const result = await Effect.runPromise(updateOne(newerPlatform, true));

    expect(result.ok).toBe(true);
    expect(result.message).toContain('newer than latest');
    expect(result.message).toContain('skipping');

    const updateCommands = vi
      .mocked(shell.run)
      .mock.calls.filter(
        (call) =>
          call[0] === 'opencode' &&
          call[1]?.[0] === 'plugin' &&
          call[1]?.[1] === '@maestria/opencode@0.2.0',
      );
    expect(updateCommands).toHaveLength(0);
  });

  it('honors an explicit -V pin even when it downgrades below the installed version', async () => {
    vi.clearAllMocks();
    vi.mocked(shell.run).mockImplementation((cmd, args) => {
      if (cmd === 'cat') {
        if (args[0].includes('.cache/opencode/packages/')) {
          return Effect.succeed(JSON.stringify({ version: '0.99.0' }));
        }
        return Effect.succeed('{ "plugin": ["@maestria/opencode@0.99.0"] }');
      }
      return Effect.succeed('');
    });

    const openCodePlatform = {
      ...requirePlatform('opencode'),
      getLatestVersion: Effect.succeed('0.2.0'),
    };
    const result = await Effect.runPromise(updateOne(openCodePlatform, true, '0.2.0'));

    expect(result.message).not.toContain('newer than latest');
    expect(result.message).not.toContain('skipping');

    const pinnedUpdateCommands = vi
      .mocked(shell.run)
      .mock.calls.filter(
        (call) =>
          call[0] === 'opencode' &&
          call[1]?.[0] === 'plugin' &&
          call[1]?.[1] === '@maestria/opencode@0.2.0',
      );
    expect(pinnedUpdateCommands).toHaveLength(1);
  });

  it('does not offer a newer-than-latest install in the interactive picker', async () => {
    vi.clearAllMocks();
    vi.mocked(shell.run).mockImplementation(() => Effect.succeed(''));
    fsMocks.readFile.mockResolvedValue(
      JSON.stringify({ name: '@maestria/opencode', version: '0.99.0' }),
    );

    const { needsUpdateOf } = await import('@/lib/freshness.js');

    // Picker semantics: only strictly-BEHIND platforms are offered.
    expect(needsUpdateOf('0.99.0', '0.2.0')).toBe(false);
    expect(needsUpdateOf('0.1.0', '0.2.0')).toBe(true);
  });
});
