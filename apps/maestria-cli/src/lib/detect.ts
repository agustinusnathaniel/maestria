import { Effect } from 'effect';
import { platforms } from './platforms.js';
import type { PlatformHandler } from './platforms.js';
import type { PlatformStatus } from '../types.js';

/**
 * Check availability + installation + versions for all platforms.
 * Runs detection in parallel for speed.
 */
export function detectAll(): Effect.Effect<PlatformStatus[], never> {
  return Effect.all(
    platforms.map((p) => detectOne(p)),
    { concurrency: 'unbounded' },
  );
}

function detectOne(platform: PlatformHandler): Effect.Effect<PlatformStatus, never> {
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
      id: platform.id,
      label: platform.label,
      available,
      installed,
      installedVersion,
      latestVersion,
    };
  });
}

/**
 * Get only the platforms that are both available and have maestria installed.
 */
export function detectInstalled(): Effect.Effect<PlatformStatus[], never> {
  return detectAll().pipe(Effect.map((stats) => stats.filter((s) => s.available && s.installed)));
}
