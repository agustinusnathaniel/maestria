import { Effect } from 'effect';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { getPlatform } from '@/lib/platforms.js';
import type { PlatformHandler } from '@/lib/platforms.js';
import * as shell from '@/lib/shell.js';

// The Claude Code install/update effects stage the plugin payload through the
// local marketplace cache (npm pack, tarball lookup, manifest write) before
// issuing any host command. Those staging directories are captured at module
// load, so executing the effects against the real filesystem would touch the
// developer machine. The filesystem is therefore fully stubbed here and a
// pre-seeded tarball name lets the pack lookup succeed without disk I/O; the
// only observable behavior under test is which host commands run and with
// what deadline.
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

  it('gives install payload materialization the generous deadline', async () => {
    await Effect.runPromise(requirePlatform('claude-code').install);

    const calls = claudeCalls();
    expect(calls).toContainEqual([
      ['plugin', 'install', 'maestria@maestria', '--scope', 'user'],
      120_000,
    ]);
    expect(calls).toContainEqual([['plugin', 'marketplace', 'update', 'maestria'], 120_000]);
  });

  it('gives the update the generous deadline while local reads stay short', async () => {
    await Effect.runPromise(requirePlatform('claude-code').update());

    const calls = claudeCalls();
    expect(calls).toContainEqual([
      ['plugin', 'update', 'maestria@maestria', '--scope', 'user'],
      120_000,
    ]);
    expect(calls).toContainEqual([['plugin', 'marketplace', 'update', 'maestria'], 120_000]);
    // Local marketplace inspection never fetches: it keeps the short default.
    expect(calls).toContainEqual([['plugin', 'marketplace', 'list', '--json'], undefined]);
  });
});
