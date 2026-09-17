import { Effect } from 'effect';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { handleInstall } from '@/commands/install.js';
import { handleUninstall } from '@/commands/uninstall.js';
import { handleUpdate } from '@/commands/update.js';
import type * as detect from '@/lib/detect.js';
import type * as platforms from '@/lib/platforms.js';
import type { PlatformHandler } from '@/lib/platforms.js';
import type { PlatformStatus } from '@/types.js';

const platformMocks = vi.hoisted(() => ({
  getPlatform: vi.fn<(id: string) => PlatformHandler | undefined>(),
}));
const detectMocks = vi.hoisted(() => ({
  detectAll: vi.fn(),
  detectInstalled: vi.fn(),
}));

vi.mock('@/lib/platforms.js', async (importOriginal) => {
  const actual = await importOriginal<typeof platforms>();
  return {
    ...actual,
    getPlatform: platformMocks.getPlatform,
    getPlatformOrResult: (id: string, fallbackLabel?: string) =>
      platformMocks.getPlatform(id) ?? actual.getPlatformOrResult(id, fallbackLabel),
  };
});

vi.mock('@/lib/detect.js', async (importOriginal) => {
  const actual = await importOriginal<typeof detect>();
  return {
    ...actual,
    detectAll: detectMocks.detectAll,
    detectInstalled: detectMocks.detectInstalled,
  };
});

const events: string[] = [];

const operation = (kind: string, id: string): Effect.Effect<void> =>
  Effect.gen(function* operationEffect() {
    events.push(`${kind}:start:${id}`);
    yield* Effect.promise(async () => {});
    events.push(`${kind}:finish:${id}`);
  });

const makePlatform = (id: 'opencode' | 'pi'): PlatformHandler => ({
  detect: Effect.succeed(true),
  getInstalledVersion: Effect.succeed('0.1.0'),
  getLatestVersion: Effect.succeed('1.0.0'),
  id,
  install: operation('install', id),
  isInstalled: Effect.succeed(true),
  label: id === 'opencode' ? 'OpenCode' : 'Pi',
  uninstall: operation('uninstall', id),
  update: () => operation('update', id),
});

const testPlatforms = [makePlatform('opencode'), makePlatform('pi')];

const installedStatuses: PlatformStatus[] = testPlatforms.map((platform) => ({
  available: true,
  id: platform.id,
  installed: true,
  installedVersion: '0.1.0',
  label: platform.label,
  latestVersion: '1.0.0',
}));

const installableStatuses: PlatformStatus[] = installedStatuses.map((status) => ({
  ...status,
  installed: false,
}));

describe('bulk CLI side-effect ordering', () => {
  beforeEach(() => {
    events.length = 0;
    vi.clearAllMocks();
    platformMocks.getPlatform.mockImplementation((id: string) =>
      testPlatforms.find((platform) => platform.id === id),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('updates direct platform selections sequentially', async () => {
    const result = await handleUpdate({
      compact: true,
      platform: 'opencode,pi',
      quiet: true,
      version: '1.0.0',
    });

    expect(events).toEqual([
      'update:start:opencode',
      'update:finish:opencode',
      'update:start:pi',
      'update:finish:pi',
    ]);
    expect(result.exitCode).toBe(0);
  });

  it('updates all detected platforms sequentially', async () => {
    detectMocks.detectInstalled.mockReturnValue(Effect.succeed(installedStatuses));

    const result = await handleUpdate({
      all: true,
      compact: true,
      quiet: true,
      version: '1.0.0',
    });

    expect(events).toEqual([
      'update:start:opencode',
      'update:finish:opencode',
      'update:start:pi',
      'update:finish:pi',
    ]);
    expect(result.exitCode).toBe(0);
  });

  it('installs direct platform selections sequentially', async () => {
    const result = await handleInstall({
      compact: true,
      platform: 'opencode,pi',
      quiet: true,
    });

    expect(events).toEqual([
      'install:start:opencode',
      'install:finish:opencode',
      'install:start:pi',
      'install:finish:pi',
    ]);
    expect(result.exitCode).toBe(0);
  });

  it('installs all detected platforms sequentially', async () => {
    detectMocks.detectAll.mockReturnValue(Effect.succeed(installableStatuses));

    const result = await handleInstall({ all: true, compact: true, quiet: true });

    expect(events).toEqual([
      'install:start:opencode',
      'install:finish:opencode',
      'install:start:pi',
      'install:finish:pi',
    ]);
    expect(result.exitCode).toBe(0);
  });

  it('uninstalls all detected platforms sequentially', async () => {
    detectMocks.detectInstalled.mockReturnValue(Effect.succeed(installedStatuses));

    const result = await handleUninstall({ all: true, compact: true, quiet: true });

    expect(events).toEqual([
      'uninstall:start:opencode',
      'uninstall:finish:opencode',
      'uninstall:start:pi',
      'uninstall:finish:pi',
    ]);
    expect(result.exitCode).toBe(0);
  });
});
