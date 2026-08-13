import { describe, it, expect, vi } from 'vite-plus/test';
import { Effect } from 'effect';

// Stub the Prime version lookup's Node fs read (cross-platform, not a POSIX
// `cat`) plus the version-cache write so npmViewVersion cannot touch the real
// home directory during tests, and the isolated temp-cwd create/remove so the
// fail-closed path can be exercised deterministically.
const fsMocks = vi.hoisted(() => ({
  readFile: vi.fn(async (_path: string) => JSON.stringify({ version: '0.2.0' })),
  mkdtemp: vi.fn(async (prefix: string) => `${prefix}test-dir`),
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
    readFile: fsMocks.readFile,
    writeFile: vi.fn(async () => {}),
    mkdir: vi.fn(async () => {}),
    mkdtemp: fsMocks.mkdtemp,
    rm: fsMocks.rm,
  };
});

import * as shell from '@/lib/shell.js';
import { getPlatform } from '@/lib/platforms.js';
import { updateOne } from '@/commands/update.js';

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

    const result = await Effect.runPromise(updateOne(getPlatform('prime-agent')!, true));

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

    const result = await Effect.runPromise(updateOne(getPlatform('prime-agent')!, true));

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

    const result = await Effect.runPromise(updateOne(getPlatform('prime-agent')!, true));

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

    const result = await Effect.runPromise(updateOne(getPlatform('prime-agent')!, true));

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

    const result = await Effect.runPromise(updateOne(getPlatform('prime-agent')!, true));

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
