import { Effect } from 'effect';
import { platforms, getPlatform } from '@/lib/platforms.js';
import type { PlatformHandler } from '@/lib/platforms.js';
import type { PlatformStatus } from '@/types.js';

/**
 * Check availability + installation + versions for all platforms.
 * Runs detection in parallel for speed.
 */
export function detectAll(): Effect.Effect<PlatformStatus[]> {
  return Effect.all(
    platforms.map((p) => detectOne(p)),
    { concurrency: 'unbounded' },
  );
}

function detectOne(platform: PlatformHandler): Effect.Effect<PlatformStatus> {
  return Effect.gen(function* () {
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
}

/**
 * Check availability + installation + versions for a single platform.
 */
export function detectSingle(platformId: string): Effect.Effect<PlatformStatus> {
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
}

/**
 * Get only the platforms that are both available and have maestria installed.
 */
export function detectInstalled(): Effect.Effect<PlatformStatus[]> {
  return detectAll().pipe(Effect.map((stats) => stats.filter((s) => s.available && s.installed)));
}
