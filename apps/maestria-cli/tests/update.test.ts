import { Effect } from 'effect';
import { describe, expect, it, vi } from 'vite-plus/test';

// Stub the Prime version lookup's Node fs read (cross-platform, not a POSIX
// `cat`) plus the version-cache write so npmViewVersion cannot touch the real
// home directory during tests, and the isolated temp-cwd create/remove so the
// fail-closed path can be exercised deterministically.
const fsMocks = vi.hoisted(() => ({
  mkdtemp: vi.fn((prefix: string) => `${prefix}test-dir`),
  readFile: vi.fn((_path: string) => JSON.stringify({ version: '0.2.0' })),
  rm: vi.fn(async () => {}),
}));

vi.mock('@/lib/shell.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/shell.js')>();
  return {
    ...actual,
    // Return a real Effect so module-evaluation .pipe() chains in platforms.ts
    // keep working; executing it resolves without spawning any subprocess.
    run: vi.fn((_cmd: string, _args: string[], _timeoutMs?: number) => Effect.succeed('')),
    sh: vi.fn((_command: string, _timeoutMs?: number) => Effect.succeed('')),
  };
});

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    mkdir: vi.fn(async () => {}),
    mkdtemp: fsMocks.mkdtemp,
    readFile: fsMocks.readFile,
    rm: fsMocks.rm,
    writeFile: vi.fn(async () => {}),
  };
});

import { updateOne } from '@/commands/update.js';
import { getPlatform } from '@/lib/platforms.js';
import * as shell from '@/lib/shell.js';

const PRIME_PACKAGE_LIST = {
  /** Version-pinned user-scope registration, installed at 0.2.0. */
  pinned: [
    'User packages:',
    '  npm:@maestria/prime-agent@0.2.0',
    '    /home/user/.npm-global/lib/node_modules/@maestria/prime-agent',
  ].join('\n'),
  /** Unpinned user-scope registration. */
  unpinned: [
    'User packages:',
    '  npm:@maestria/prime-agent',
    '    /home/user/.npm-global/lib/node_modules/@maestria/prime-agent',
  ].join('\n'),
};

function primePlatform(latestVersion = '0.2.0') {
  return {
    ...getPlatform('prime-agent')!,
    // npmViewVersion closes over shell.run internally, so replace the handler
    // effect at the command seam instead of allowing these tests to hit npm.
    getLatestVersion: Effect.succeed(latestVersion),
  };
}

// updateOne is the per-platform routine behind `maestria update <platform>`
// (and the --all / interactive paths). These are command-level regressions for
// the interaction between Prime's version-pinned registration check
// (preflightUpdate) and the "Already up to date" version-equality short-circuit.
describe('update command - Prime Agent', () => {
  it('reports a pinned registration as an error even when the installed version equals the latest', async () => {
    vi.clearAllMocks();
    vi.mocked(shell.run).mockImplementation((cmd, args) => {
      if (cmd === 'prime-agent' && args.join(' ') === 'package list') {
        return Effect.succeed(PRIME_PACKAGE_LIST.pinned);
      }
      if (cmd === 'npm' && args[0] === 'view') {
        // Latest available version equals the installed version (0.2.0).
        // Without the preflight this would short-circuit as a successful
        // "Already up to date" no-op.
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

    // No Prime package update command may be issued for a pinned registration.
    const updateCommands = vi
      .mocked(shell.run)
      .mock.calls.filter(
        (call) =>
          call[0] === 'prime-agent' && call[1]?.[0] === 'package' && call[1]?.[1] === 'update',
      );
    expect(updateCommands).toHaveLength(0);

    // The version cache must not be invalidated (invalidateVersionCache reads
    // the cache file via the shell; it is never reached on the failure path).
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

    // The preflight passes, so no Prime package update command is issued either.
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
    // One snapshot before the update command (shared by the version check, the
    // preflight, and the update step) plus one refresh after it. Before the
    // snapshot this was three lists before the update command and one after.
    expect(listCalls).toHaveLength(2);

    const updateCommands = vi
      .mocked(shell.run)
      .mock.calls.filter(
        (call) =>
          call[0] === 'prime-agent' && call[1]?.[0] === 'package' && call[1]?.[1] === 'update',
      );
    expect(updateCommands).toHaveLength(1);
    // The update command itself runs from an isolated temp cwd.
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

    // The project-scope pin must not block the update (only the user scope is
    // managed), and exactly one user-scope update command is issued.
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
    // The update runs from a fresh isolated temp cwd (never the invoking
    // project directory), so project settings are not scanned or modified.
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

    // The update reports the failure instead of running blind, and no Prime
    // package update command is issued.
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

// An implicit update (no --version) must never DOWNGRADE an install that is
// AHEAD of the registry (local dev build ahead of npm). This mirrors
// freshnessOf(): `maestria check` exits 0 for newer-than-latest, so update must
// agree. An explicit -V pin is honored verbatim, downgrades included.
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

    // No Prime package update command may be issued for a downgrade.
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
    // OpenCode supports version pinning, so an explicit -V reaches the update
    // step instead of exiting at the "pinning is not supported" check.
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
      ...getPlatform('opencode')!,
      getLatestVersion: Effect.succeed('0.2.0'),
    };
    const result = await Effect.runPromise(updateOne(openCodePlatform, true, '0.2.0'));

    // The downgrade guard must NOT fire for an explicitly pinned target.
    expect(result.message).not.toContain('newer than latest');
    expect(result.message).not.toContain('skipping');

    // Proceeding past the guard means the pinned update command WAS issued.
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
