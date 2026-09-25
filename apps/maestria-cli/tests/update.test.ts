import { Effect } from 'effect';
import type * as FsPromises from 'node:fs/promises';
import { describe, expect, it, vi } from 'vite-plus/test';

import { updateOne } from '@/lib/platform-transaction.js';
import { getPlatform } from '@/lib/platforms.js';
import * as shell from '@/lib/shell.js';

// Stub the fs read plus the version-cache write and the isolated temp-cwd
// create/remove so the fail-closed path is exercised deterministically.
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

const PRIME_PACKAGE_LIST = {
  pinned: [
    'User packages:',
    '  npm:@maestria/prime-agent@0.2.0',
    '    /home/user/.npm-global/lib/node_modules/@maestria/prime-agent',
  ].join('\n'),
  unpinned: [
    'User packages:',
    '  npm:@maestria/prime-agent',
    '    /home/user/.npm-global/lib/node_modules/@maestria/prime-agent',
  ].join('\n'),
};

const requirePlatform = (id: string): NonNullable<ReturnType<typeof getPlatform>> => {
  const platform = getPlatform(id);
  if (platform === undefined) {
    throw new Error(`Platform not found: ${id}`);
  }
  return platform;
};

const primePlatform = (latestVersion = '0.2.0') => ({
  ...requirePlatform('prime-agent'),
  getLatestVersion: Effect.succeed(latestVersion),
});

// Command-level regressions for the version-pinned registration check
// (preflightUpdate) against the "Already up to date" short-circuit.
describe('update command - Prime Agent', () => {
  it('reports a pinned registration as an error even when the installed version equals the latest', async () => {
    vi.clearAllMocks();
    vi.mocked(shell.run).mockImplementation((cmd, args) => {
      if (cmd === 'prime-agent' && args.join(' ') === 'package list') {
        return Effect.succeed(PRIME_PACKAGE_LIST.pinned);
      }
      if (cmd === 'npm' && args[0] === 'view') {
        return Effect.succeed('0.2.0');
      }
      return Effect.succeed('');
    });
    fsMocks.readFile.mockResolvedValue(
      JSON.stringify({ name: '@maestria/prime-agent', version: '0.2.0' }),
    );

    const result = await Effect.runPromise(updateOne(primePlatform(), true));

    expect(result.ok).toBe(false);
    expect(result.message).toContain('version-pinned');
    expect(result.message).toContain('npm:@maestria/prime-agent@0.2.0');
    expect(result.message).not.toContain('Already up to date');

    const updateCommands = vi
      .mocked(shell.run)
      .mock.calls.filter(
        (call) =>
          call[0] === 'prime-agent' && call[1]?.[0] === 'package' && call[1]?.[1] === 'update',
      );
    expect(updateCommands).toHaveLength(0);
    expect(shell.run).not.toHaveBeenCalledWith('cat', expect.stringContaining('versions.json'));
  });

  it('keeps reporting "Already up to date" for an unpinned registration at the latest version', async () => {
    vi.clearAllMocks();
    vi.mocked(shell.run).mockImplementation((cmd, args) => {
      if (cmd === 'prime-agent' && args.join(' ') === 'package list') {
        return Effect.succeed(PRIME_PACKAGE_LIST.unpinned);
      }
      if (cmd === 'npm' && args[0] === 'view') {
        return Effect.succeed('0.2.0');
      }
      return Effect.succeed('');
    });
    fsMocks.readFile.mockResolvedValue(
      JSON.stringify({ name: '@maestria/prime-agent', version: '0.2.0' }),
    );

    const result = await Effect.runPromise(updateOne(primePlatform(), true));

    expect(result.ok).toBe(true);
    expect(result.message).toBe('Already up to date');
    expect(result.nextVersion).toBe('0.2.0');

    const updateCommands = vi
      .mocked(shell.run)
      .mock.calls.filter(
        (call) =>
          call[0] === 'prime-agent' && call[1]?.[0] === 'package' && call[1]?.[1] === 'update',
      );
    expect(updateCommands).toHaveLength(0);
  });

  it('runs a normal update from a single per-update registration snapshot', async () => {
    vi.clearAllMocks();
    vi.mocked(shell.run).mockImplementation((cmd, args) => {
      if (cmd === 'prime-agent' && args.join(' ') === 'package list') {
        return Effect.succeed(PRIME_PACKAGE_LIST.unpinned);
      }
      if (cmd === 'npm' && args[0] === 'view') {
        return Effect.succeed('0.2.0');
      }
      return Effect.succeed('');
    });
    fsMocks.readFile.mockResolvedValue(
      JSON.stringify({ name: '@maestria/prime-agent', version: '0.1.0' }),
    );

    const result = await Effect.runPromise(updateOne(primePlatform(), true));

    expect(result.ok).toBe(true);
    expect(result.message).toBe('Updated');
    expect(result.prevVersion).toBe('0.1.0');

    const listCalls = vi
      .mocked(shell.run)
      .mock.calls.filter(
        (call) => call[0] === 'prime-agent' && call[1]?.join(' ') === 'package list',
      );
    expect(listCalls).toHaveLength(2);

    const updateCommands = vi
      .mocked(shell.run)
      .mock.calls.filter(
        (call) =>
          call[0] === 'prime-agent' && call[1]?.[0] === 'package' && call[1]?.[1] === 'update',
      );
    expect(updateCommands).toHaveLength(1);
    expect(typeof updateCommands[0][3]).toBe('string');
  });

  it('updates only the user registration from an isolated cwd when the project registration is pinned', async () => {
    vi.clearAllMocks();
    vi.mocked(shell.run).mockImplementation((cmd, args) => {
      if (cmd === 'prime-agent' && args.join(' ') === 'package list') {
        return Effect.succeed(
          [
            'User packages:',
            '  npm:@maestria/prime-agent',
            '    /home/user/.npm-global/lib/node_modules/@maestria/prime-agent',
            'Project packages:',
            '  npm:@maestria/prime-agent@0.1.0',
            '    /project/.prime/agent/npm/node_modules/@maestria/prime-agent',
          ].join('\n'),
        );
      }
      if (cmd === 'npm' && args[0] === 'view') {
        return Effect.succeed('0.2.0');
      }
      return Effect.succeed('');
    });
    fsMocks.readFile.mockResolvedValue(
      JSON.stringify({ name: '@maestria/prime-agent', version: '0.1.0' }),
    );

    const result = await Effect.runPromise(updateOne(primePlatform(), true));

    expect(result.ok).toBe(true);
    expect(result.message).toBe('Updated');

    const updateCommands = vi
      .mocked(shell.run)
      .mock.calls.filter(
        (call) =>
          call[0] === 'prime-agent' && call[1]?.[0] === 'package' && call[1]?.[1] === 'update',
      );
    expect(updateCommands).toHaveLength(1);
    expect(updateCommands[0][1]).toEqual(['package', 'update', 'npm:@maestria/prime-agent']);
    expect(typeof updateCommands[0][3]).toBe('string');
    expect(updateCommands[0][3]).not.toBe(process.cwd());
  });

  it('fails closed with an accurate error when the isolated temp cwd cannot be created', async () => {
    vi.clearAllMocks();
    vi.mocked(shell.run).mockImplementation((cmd, args) => {
      if (cmd === 'prime-agent' && args.join(' ') === 'package list') {
        return Effect.succeed(PRIME_PACKAGE_LIST.unpinned);
      }
      return Effect.succeed('');
    });
    fsMocks.mkdtemp.mockRejectedValueOnce(new Error('ENOSPC'));

    const result = await Effect.runPromise(updateOne(primePlatform(), true));

    expect(result.ok).toBe(false);
    expect(result.message).toContain('Failed to create an isolated working directory');
    const updateCommands = vi
      .mocked(shell.run)
      .mock.calls.filter(
        (call) =>
          call[0] === 'prime-agent' && call[1]?.[0] === 'package' && call[1]?.[1] === 'update',
      );
    expect(updateCommands).toHaveLength(0);
  });
});

// An implicit update (no --version) must never downgrade an install that is
// ahead of the registry. An explicit -V pin is honored verbatim.
describe('update command - no silent downgrade', () => {
  it('skips an implicit update when the installed version is newer than latest', async () => {
    vi.clearAllMocks();
    vi.mocked(shell.run).mockImplementation((cmd, args) => {
      if (cmd === 'prime-agent' && args.join(' ') === 'package list') {
        return Effect.succeed(PRIME_PACKAGE_LIST.unpinned);
      }
      return Effect.succeed('');
    });
    fsMocks.readFile.mockResolvedValue(
      JSON.stringify({ name: '@maestria/prime-agent', version: '0.99.0' }),
    );

    const result = await Effect.runPromise(updateOne(primePlatform('0.2.0'), true));

    expect(result.ok).toBe(true);
    expect(result.message).toContain('newer than latest');
    expect(result.message).toContain('skipping');

    const updateCommands = vi
      .mocked(shell.run)
      .mock.calls.filter(
        (call) =>
          call[0] === 'prime-agent' && call[1]?.[0] === 'package' && call[1]?.[1] === 'update',
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
      JSON.stringify({ name: '@maestria/prime-agent', version: '0.99.0' }),
    );

    const { needsUpdateOf } = await import('@/lib/freshness.js');

    // Picker semantics: only strictly-BEHIND platforms are offered.
    expect(needsUpdateOf('0.99.0', '0.2.0')).toBe(false);
    expect(needsUpdateOf('0.1.0', '0.2.0')).toBe(true);
  });
});
