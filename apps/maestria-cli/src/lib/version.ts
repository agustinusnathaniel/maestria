/**
 * Simple regex for semver validation.
 * Matches MAJOR.MINOR.PATCH with optional prerelease and build metadata.
 * Each prerelease/build identifier must be non-empty.
 */
const SEMVER_REGEX = /^\d+\.\d+\.\d+(-[\w]+(\.[\w]+)*)?(\+[\w]+(\.[\w]+)*)?$/;

/**
 * Validate a version string. Accepts 'latest' and '' as special values.
 */
export function isValidVersion(v: string): boolean {
  if (v === 'latest' || v === '') return true;
  return SEMVER_REGEX.test(v);
}

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
 *
 * @returns -1 if a < b, 0 if equal, 1 if a > b, null if either is 'unknown'
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 | null {
  if (a === 'unknown' || b === 'unknown') return null;
  if (a === 'latest') return b === 'latest' ? 0 : 1;
  if (b === 'latest') return -1;

  const result = a.localeCompare(b, undefined, { numeric: true });
  if (result === 0) return 0;

  // Fix prerelease ordering per semver spec:
  // localeCompare reverses prerelease vs release because '-' sorts after
  // end-of-string (e.g., "1.0.0-alpha" > "1.0.0" with localeCompare).
  // If both share the same MAJOR.MINOR.PATCH and exactly one has a
  // prerelease tag, reverse the result.
  const stripSuffix = /(-[\w]+(\.[\w]+)*)?(\+[\w]+(\.[\w]+)*)?$/;
  const aBase = a.replace(stripSuffix, '');
  const bBase = b.replace(stripSuffix, '');
  if (aBase === bBase) {
    const aIsPrerelease = a.length > aBase.length && a[aBase.length] === '-';
    const bIsPrerelease = b.length > bBase.length && b[bBase.length] === '-';
    if (aIsPrerelease !== bIsPrerelease) {
      return result > 0 ? -1 : 1;
    }
  }

  return result < 0 ? -1 : 1;
}

/** Strict semver equality check. Handles 'latest' and 'unknown'. */
export function isVersionEq(a: string, b: string): boolean {
  if (a === b) return true;
  return compareVersions(a, b) === 0;
}

/** Check if a is strictly less than b. */
export function isVersionLt(a: string, b: string): boolean {
  return compareVersions(a, b) === -1;
}

/** Check if a differs from b (for "needs update" detection). Returns false if either is 'unknown'. */
export function isVersionDifferent(a: string, b: string): boolean {
  if (a === 'unknown' || b === 'unknown') return false;
  return compareVersions(a, b) !== 0;
}
