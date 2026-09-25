import { compareVersions } from '@/lib/version.js';

/** How an installed version relates to the latest published version. */
export type Freshness = 'current' | 'outdated' | 'unknown';

/**
 * Classify an installed version against latest. Newer-than-latest (a local/dev
 * build ahead of the registry) is 'current', never outdated. Uncomparable
 * sides ('', 'unknown', non-semver) are 'unknown'.
 */
export const freshnessOf = (installedVersion: string, latestVersion: string): Freshness => {
  const comparison = compareVersions(installedVersion, latestVersion);
  if (comparison === null) {
    return 'unknown';
  }
  if (comparison === 0) {
    return 'current';
  }
  if (comparison === -1) {
    return 'outdated';
  }
  return 'current';
};

/**
 * Whether an install needs an update: strictly BEHIND latest. Ahead-of-latest
 * never needs one, mirroring freshnessOf(), so `maestria check` and update
 * paths agree on the same machine state.
 */
export const needsUpdateOf = (installedVersion: string, latestVersion: string): boolean =>
  compareVersions(installedVersion, latestVersion) === -1;

/** Exit code for `maestria check`: 0 = ok, 1 = not installed/unavailable, 3 = outdated. */
export const checkExitCode = (freshness: Freshness, installed: boolean): number => {
  if (!installed) {
    return 1;
  }
  return freshness === 'outdated' ? 3 : 0;
};
