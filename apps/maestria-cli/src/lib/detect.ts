import { Effect } from 'effect';

import { getPlatform, platforms } from '@/lib/platforms.js';
import type { PlatformHandler } from '@/lib/platforms.js';
import type { PlatformStatus } from '@/types.js';

/**
 * Check availability + installation + versions for all platforms.
 * Runs detection in parallel for speed.
 */
const detectOne = (platform: PlatformHandler): Effect.Effect<PlatformStatus> =>
  Effect.gen(function* detectOneEffect() {
    const available = yield* platform.detect;
    let installed = false;
    let installedVersion = '';
    let latestVersion = '';

    if (available) {
      installed = yield* platform.isInstalled;
      if (installed) {
        installedVersion = yield* platform.getInstalledVersion.pipe(
          Effect.catchCause(() => Effect.succeed('unknown')),
        );
      }
      latestVersion = yield* platform.getLatestVersion.pipe(
        Effect.catchCause(() => Effect.succeed('')),
      );
    }

    return {
      available,
      id: platform.id,
      installed,
      installedVersion,
      label: platform.label,
      latestVersion,
    };
  });

export const detectAll = (): Effect.Effect<PlatformStatus[]> =>
  Effect.all(
    platforms.map((p) => detectOne(p)),
    { concurrency: 'unbounded' },
  );

/**
 * Check availability + installation + versions for a single platform.
 */
export const detectSingle = (platformId: string): Effect.Effect<PlatformStatus> => {
  const handler = getPlatform(platformId);
  if (!handler) {
    return Effect.succeed({
      available: false,
      id: platformId,
      installed: false,
      installedVersion: '',
      label: platformId,
      latestVersion: '',
    });
  }
  return detectOne(handler);
};

/**
 * Get only the platforms that are both available and have maestria installed.
 */
export const detectInstalled = (): Effect.Effect<PlatformStatus[]> =>
  detectAll().pipe(Effect.map((stats) => stats.filter((s) => s.available && s.installed)));
