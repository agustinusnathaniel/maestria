import { compareVersions, isVersionDifferent } from '@/lib/version.js';

/** How an installed version relates to the latest published version. */
export type Freshness = 'current' | 'outdated' | 'unknown';

/**
 * Classify an installed version against the latest published version.
 *
 * - 'outdated': installed is strictly older than latest.
 * - 'current': installed equals latest, or is NEWER than latest (a local/dev
 *   build ahead of the registry is never flagged as outdated).
 * - 'unknown': either side is '', 'unknown', or otherwise not semver-comparable.
 */
export function freshnessOf(installedVersion: string, latestVersion: string): Freshness {
  const comparison = compareVersions(installedVersion, latestVersion);
  if (comparison === null) return 'unknown';
  if (comparison === 0) return 'current';
  if (comparison === -1 && isVersionDifferent(installedVersion, latestVersion)) {
    return 'outdated';
  }
  return 'current';
}

/**
 * Exit code for `maestria check`: 0 = ok, 1 = not installed/unavailable,
 * 3 = installed but outdated.
 */
export function checkExitCode(freshness: Freshness, installed: boolean): number {
  if (!installed) return 1;
  return freshness === 'outdated' ? 3 : 0;
}
