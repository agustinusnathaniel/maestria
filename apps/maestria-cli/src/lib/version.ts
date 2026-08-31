/**
 * Simple regex for semver validation.
 * Matches MAJOR.MINOR.PATCH with optional prerelease and build metadata.
 * Each prerelease/build identifier must be non-empty.
 */
const SEMVER_REGEX =
  /^\d+\.\d+\.\d+(?<prerelease>-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?<build>\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;

/**
 * Validate a version string. Accepts 'latest' and '' as special values.
 */
export const isValidVersion = (v: string): boolean => {
  if (v === 'latest' || v === '') {
    return true;
  }
  return SEMVER_REGEX.test(v);
};

/**
 * Compare two version strings using numeric-aware locale comparison.
 *
 * Uses `localeCompare` with `{ numeric: true }` for correct numeric segment
 * ordering (e.g., `0.10.0 > 0.9.0`). Includes a semver-compliant correction
 * for prerelease ordering: `1.0.0-alpha < 1.0.0` (prerelease < release).
 *
 * Special values:
 * - 'latest' is always greater than any semver version
 * - 'unknown' returns null (insufficient information to compare)
 * - non-semver values (e.g. display sentinels like 'see GitHub releases')
 *   return null (insufficient information to compare)
 *
 * @returns -1 if a < b, 0 if equal, 1 if a > b, null if either is 'unknown'
 *   or not a valid semver version
 */
export const compareVersions = (a: string, b: string): -1 | 0 | 1 | null => {
  if (a === 'unknown' || b === 'unknown') {
    return null;
  }
  if (a === 'latest') {
    return b === 'latest' ? 0 : 1;
  }
  if (b === 'latest') {
    return -1;
  }

  if (!SEMVER_REGEX.test(a) || !SEMVER_REGEX.test(b)) {
    return null;
  }

  // Per semver 2.0.0 spec section 10, build metadata MUST be ignored
  // when determining version precedence.
  const aWithoutBuild = a.replace(/\+.*$/u, '');
  const bWithoutBuild = b.replace(/\+.*$/u, '');

  const result = aWithoutBuild.localeCompare(bWithoutBuild, undefined, { numeric: true });
  if (result === 0) {
    return 0;
  }

  // Fix prerelease ordering per semver spec:
  // localeCompare reverses prerelease vs release because '-' sorts after
  // end-of-string (e.g., "1.0.0-alpha" > "1.0.0" with localeCompare).
  // If both share the same MAJOR.MINOR.PATCH and exactly one has a
  // prerelease tag, reverse the result.
  const stripSuffix =
    /(?<prerelease>-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?<build>\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;
  const aBase = aWithoutBuild.replace(stripSuffix, '');
  const bBase = bWithoutBuild.replace(stripSuffix, '');
  if (aBase === bBase) {
    const aIsPrerelease =
      aWithoutBuild.length > aBase.length && aWithoutBuild[aBase.length] === '-';
    const bIsPrerelease =
      bWithoutBuild.length > bBase.length && bWithoutBuild[bBase.length] === '-';
    if (aIsPrerelease !== bIsPrerelease) {
      return result > 0 ? -1 : 1;
    }
  }

  return result < 0 ? -1 : 1;
};

/** Strict semver equality check. Handles 'latest' and 'unknown'. */
export const isVersionEq = (a: string, b: string): boolean => {
  if (a === b) {
    return true;
  }
  return compareVersions(a, b) === 0;
};

/** Check if a is strictly less than b. */
export const isVersionLt = (a: string, b: string): boolean => compareVersions(a, b) === -1;

/** Check if a differs from b (for "needs update" detection). Returns false if either is 'unknown' or incomparable (non-semver). */
export const isVersionDifferent = (a: string, b: string): boolean => {
  if (a === 'unknown' || b === 'unknown') {
    return false;
  }
  const result = compareVersions(a, b);
  return result !== null && result !== 0;
};

/**
 * Check if a is strictly greater than b ('a' is ahead of 'b'). Returns false
 * if either is 'unknown' or incomparable (non-semver).
 */
export const isVersionGt = (a: string, b: string): boolean => compareVersions(a, b) === 1;
