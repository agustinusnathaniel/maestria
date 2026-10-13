import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { Cause, Effect, Exit } from 'effect';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import * as shell from '@/lib/shell.js';

const { join } = path;

describe('getCacheDir', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('resolves XDG_CACHE_HOME when set and trims whitespace', () => {
    vi.stubEnv('XDG_CACHE_HOME', '/tmp/custom-cache');
    expect(shell.getCacheDir()).toBe('/tmp/custom-cache');
    vi.stubEnv('XDG_CACHE_HOME', '  /tmp/custom-cache  ');
    expect(shell.getCacheDir()).toBe('/tmp/custom-cache');
  });

  it('falls back to ~/.cache when XDG_CACHE_HOME is unset, empty, or whitespace', () => {
    for (const value of ['', '   ']) {
      vi.stubEnv('XDG_CACHE_HOME', value);
      expect(shell.getCacheDir()).toBe(join(homedir(), '.cache'));
    }
    delete process.env.XDG_CACHE_HOME;
    expect(shell.getCacheDir()).toBe(join(homedir(), '.cache'));
  });
});

describe('run', () => {
  it('terminates the child process when its Effect is interrupted', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'maestria-command-abort-'));
    const pidFile = join(directory, 'pid');
    const controller = new AbortController();
    let pid: number | undefined;
    const result = Effect.runPromiseExit(
      shell.run(process.execPath, [
        '-e',
        `require('node:fs').writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); setInterval(() => {}, 1000)`,
      ]),
      { signal: controller.signal },
    );
    try {
      await vi.waitFor(async () => {
        expect(await readFile(pidFile, 'utf-8')).not.toBe('');
      });
      pid = Number(await readFile(pidFile, 'utf-8'));
      controller.abort();
      const exit = await result;
      expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true);
      const childPid = pid;
      await vi.waitFor(() => {
        expect(() => process.kill(childPid, 0)).toThrow();
      });
    } finally {
      controller.abort();
      await result;
      if (pid !== undefined) {
        try {
          process.kill(pid);
        } catch {
          // The interruption already terminated the child.
        }
      }
      await rm(directory, { force: true, recursive: true });
    }
  });

  it('reports stderr and exit code when the command fails', async () => {
    const error = await Effect.runPromise(
      Effect.flip(shell.run('node', ['-e', "console.error('boom-detail'); process.exit(3)"])),
    );
    expect(error).toBeInstanceOf(shell.CommandError);
    expect(error.message).toContain('exit code 3');
    expect(error.message).toContain('boom-detail');
  });

  it('reports a timeout instead of a bare failure when the deadline kills the command', async () => {
    const error = await Effect.runPromise(
      Effect.flip(shell.run('node', ['-e', 'setTimeout(() => {}, 5000)'], 200)),
    );
    expect(error).toBeInstanceOf(shell.CommandError);
    expect(error.message).toContain('timed out after 200ms');
  });
});

describe('getMaestriaCacheDir', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('resolves under the cache dir with homedir fallback', () => {
    vi.stubEnv('XDG_CACHE_HOME', '/tmp/xdg');
    expect(shell.getMaestriaCacheDir()).toBe(join('/tmp/xdg', 'maestria'));
    delete process.env.XDG_CACHE_HOME;
    expect(shell.getMaestriaCacheDir()).toBe(join(homedir(), '.cache', 'maestria'));
  });
});

describe('getVersionCacheFile', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is versions.json under the maestria cache dir', () => {
    vi.stubEnv('XDG_CACHE_HOME', '/tmp/xdg-cache');
    expect(shell.getVersionCacheFile()).toBe(join('/tmp/xdg-cache', 'maestria', 'versions.json'));
    expect(shell.getVersionCacheFile()).toBe(join(shell.getMaestriaCacheDir(), 'versions.json'));
  });
});
