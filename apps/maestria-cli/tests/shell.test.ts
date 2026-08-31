import { homedir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import * as shell from '@/lib/shell.js';

describe('shell execution', () => {
  it('exports CommandError class', () => {
    expect(shell.CommandError).toBeDefined();
  });
  it('exports run function', () => {
    expect(typeof shell.run).toBe('function');
  });
  it('exports readTextFile function', () => {
    expect(typeof shell.readTextFile).toBe('function');
  });
  it('exports fileExists function', () => {
    expect(typeof shell.fileExists).toBe('function');
  });
});

describe('getCacheDir', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns XDG_CACHE_HOME when set', () => {
    vi.stubEnv('XDG_CACHE_HOME', '/tmp/custom-cache');
    expect(shell.getCacheDir()).toBe('/tmp/custom-cache');
  });

  it('trims whitespace from XDG_CACHE_HOME', () => {
    vi.stubEnv('XDG_CACHE_HOME', '  /tmp/custom-cache  ');
    expect(shell.getCacheDir()).toBe('/tmp/custom-cache');
  });

  it('falls back to ~/.cache when XDG_CACHE_HOME is unset', () => {
    vi.stubEnv('XDG_CACHE_HOME', '');
    // Ensure empty string is treated as unset (stub with empty then delete)
    delete process.env.XDG_CACHE_HOME;
    expect(shell.getCacheDir()).toBe(join(homedir(), '.cache'));
  });

  it('falls back to ~/.cache when XDG_CACHE_HOME is empty string', () => {
    vi.stubEnv('XDG_CACHE_HOME', '');
    expect(shell.getCacheDir()).toBe(join(homedir(), '.cache'));
  });

  it('falls back to ~/.cache when XDG_CACHE_HOME is whitespace only', () => {
    vi.stubEnv('XDG_CACHE_HOME', '   ');
    expect(shell.getCacheDir()).toBe(join(homedir(), '.cache'));
  });
});

describe('getMaestriaCacheDir', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns join(getCacheDir(), maestria)', () => {
    vi.stubEnv('XDG_CACHE_HOME', '/tmp/xdg');
    expect(shell.getMaestriaCacheDir()).toBe(join('/tmp/xdg', 'maestria'));
  });

  it('falls back to homedir cache when XDG not set', () => {
    vi.stubEnv('XDG_CACHE_HOME', '');
    delete process.env.XDG_CACHE_HOME;
    expect(shell.getMaestriaCacheDir()).toBe(join(homedir(), '.cache', 'maestria'));
  });
});

describe('getVersionCacheFile', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is under maestria cache dir', () => {
    vi.stubEnv('XDG_CACHE_HOME', '/tmp/xdg-cache');
    const expected = join('/tmp/xdg-cache', 'maestria', 'versions.json');
    expect(shell.getVersionCacheFile()).toBe(expected);
  });

  it('equals join(getMaestriaCacheDir(), versions.json)', () => {
    vi.stubEnv('XDG_CACHE_HOME', '/tmp/another');
    expect(shell.getVersionCacheFile()).toBe(join(shell.getMaestriaCacheDir(), 'versions.json'));
  });
});
