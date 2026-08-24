import { compareVersions, isVersionDifferent, isVersionGt } from '@/lib/version.js';

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
 * Whether an installed version needs an update to reach the latest published
 * version: it must be strictly BEHIND latest. An install AHEAD of latest (a
 * local/dev build) never needs an update — mirrors freshnessOf(), which
 * classifies newer-than-latest as 'current', so `maestria check` and the
 * update paths agree on the same machine state.
 */
export function needsUpdateOf(installedVersion: string, latestVersion: string): boolean {
  return (
    isVersionDifferent(installedVersion, latestVersion) &&
    !isVersionGt(installedVersion, latestVersion)
  );
}

/**
 * Exit code for `maestria check`: 0 = ok, 1 = not installed/unavailable,
 * 3 = installed but outdated.
 */
export function checkExitCode(freshness: Freshness, installed: boolean): number {
  if (!installed) return 1;
  return freshness === 'outdated' ? 3 : 0;
}
