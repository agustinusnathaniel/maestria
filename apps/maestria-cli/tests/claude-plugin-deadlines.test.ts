import { Effect } from 'effect';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { getPlatform } from '@/lib/platforms.js';
import type { PlatformHandler } from '@/lib/platforms.js';
import * as shell from '@/lib/shell.js';

// Claude install/update stage the payload through marketplace cache dirs
// frozen at module load, so the filesystem is fully stubbed here (a
// pre-seeded tarball name satisfies the pack lookup); the test observes only
// host commands and their deadlines.
vi.mock('@/lib/shell.js', async (importOriginal) => {
  const actual = await importOriginal<typeof shell>();
  return {
    ...actual,
    run: vi.fn((_cmd: string, _args: string[], _timeoutMs?: number) => Effect.succeed('')),
  };
});

interface FsPromisesStubs {
  access: () => Promise<void>;
  mkdir: () => Promise<void>;
  readFile: () => Promise<string>;
  readdir: () => Promise<string[]>;
  rm: () => Promise<void>;
  unlink: () => Promise<void>;
  writeFile: () => Promise<void>;
}

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<FsPromisesStubs>();
  return {
    ...actual,
    access: vi.fn(async () => {}),
    mkdir: vi.fn(async () => {}),
    readFile: vi.fn(async () => {
      await Promise.resolve();
      throw new Error('ENOENT: no such file or directory');
    }),
    readdir: vi.fn(async () => {
      await Promise.resolve();
      return ['maestria-claude-code-9.9.9.tgz'];
    }),
    rm: vi.fn(async () => {}),
    unlink: vi.fn(async () => {}),
    writeFile: vi.fn(async () => {}),
  };
});

const requirePlatform = (id: string): PlatformHandler => {
  const platform = getPlatform(id);
  if (platform === undefined) {
    throw new Error(`Platform not found: ${id}`);
  }
  return platform;
};

const claudeCalls = (): [string[], number | undefined][] =>
  vi
    .mocked(shell.run)
    .mock.calls.filter((call) => call[0] === 'claude')
    .map(([, args, timeoutMs]) => [args, timeoutMs]);

describe('claude-code plugin command deadlines', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('gives install, update, and refresh the generous deadline', async () => {
    await Effect.runPromise(requirePlatform('claude-code').install);
    await Effect.runPromise(requirePlatform('claude-code').update());

    const calls = claudeCalls();
    expect(calls).toContainEqual([
      ['plugin', 'install', 'maestria@maestria', '--scope', 'user'],
      120_000,
    ]);
    expect(calls).toContainEqual([
      ['plugin', 'update', 'maestria@maestria', '--scope', 'user'],
      120_000,
    ]);
    expect(calls).toContainEqual([['plugin', 'marketplace', 'update', 'maestria'], 120_000]);
    // Local marketplace inspection never fetches: it keeps the short default.
    expect(calls).toContainEqual([['plugin', 'marketplace', 'list', '--json'], undefined]);
    // Both flows must refresh and inspect: a single occurrence would let a
    // flow that dropped its refresh slip through the assertions above.
    const refreshes = calls.filter(
      ([args, timeout]) =>
        args.join(' ') === 'plugin marketplace update maestria' && timeout === 120_000,
    );
    const inspections = calls.filter(
      ([args, timeout]) =>
        args.join(' ') === 'plugin marketplace list --json' && timeout === undefined,
    );
    expect(refreshes).toHaveLength(2);
    expect(inspections).toHaveLength(2);
  });
});
