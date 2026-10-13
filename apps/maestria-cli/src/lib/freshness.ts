import { compareVersions } from '@/lib/version.js';

export type Freshness = 'current' | 'outdated' | 'unknown';

/** Ahead-of-latest (local/dev build) is 'current', never outdated. */
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

/** Strictly BEHIND latest, mirroring freshnessOf() so check and update agree. */
export const needsUpdateOf = (installedVersion: string, latestVersion: string): boolean =>
  compareVersions(installedVersion, latestVersion) === -1;

/** Exit code for `maestria check`: 0 = ok, 1 = not installed/unavailable, 3 = outdated. */
export const checkExitCode = (freshness: Freshness, installed: boolean): number => {
  if (!installed) {
    return 1;
  }
  return freshness === 'outdated' ? 3 : 0;
};
