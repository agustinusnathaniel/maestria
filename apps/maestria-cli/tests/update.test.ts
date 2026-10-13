import { Effect } from 'effect';
import { describe, expect, it, vi } from 'vite-plus/test';

import { updateOne } from '@/lib/platform-transaction.js';
import type { PlatformHandler } from '@/lib/platforms.js';

const platformAt = (installed: string, update: PlatformHandler['update']): PlatformHandler => ({
  detect: Effect.succeed(true),
  getInstalledVersion: Effect.succeed(installed),
  getLatestVersion: Effect.succeed('0.2.0'),
  id: 'pi',
  install: Effect.void,
  isInstalled: Effect.succeed(true),
  label: 'Pi',
  uninstall: Effect.void,
  update,
});

// An implicit update (no --version) must never downgrade an install that is
// ahead of the registry. An explicit -V pin is honored verbatim.
describe('update command - no silent downgrade', () => {
  it('honors an explicit -V pin even when it downgrades below the installed version', async () => {
    const update = vi.fn((_version?: string) => Effect.void);
    const result = await Effect.runPromise(updateOne(platformAt('0.99.0', update), true, '0.2.0'));

    expect(result.message).toBe('Updated');
    expect(update.mock.calls.map(([version]) => version)).toEqual(['0.2.0']);
  });
});
