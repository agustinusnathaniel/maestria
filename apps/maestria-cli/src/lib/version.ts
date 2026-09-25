/** Semver MAJOR.MINOR.PATCH with optional prerelease and build metadata. */
const SEMVER_REGEX =
  /^\d+\.\d+\.\d+(?<prerelease>-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?<build>\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;

/** Validate a version string. Accepts 'latest' and '' as special values. */
export const isValidVersion = (v: string): boolean => {
  if (v === 'latest' || v === '') {
    return true;
  }
  return SEMVER_REGEX.test(v);
};

/**
 * Compare versions with numeric-aware ordering plus semver prerelease
 * correction (`1.0.0-alpha < 1.0.0`; localeCompare alone reverses it).
 * 'latest' beats any semver; 'unknown' and non-semver return null.
 *
 * @returns -1 if a < b, 0 if equal, 1 if a > b, null if incomparable
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

  // Per semver 2.0.0 section 10, build metadata is ignored for precedence.
  const aWithoutBuild = a.replace(/\+.*$/u, '');
  const bWithoutBuild = b.replace(/\+.*$/u, '');

  const result = aWithoutBuild.localeCompare(bWithoutBuild, undefined, { numeric: true });
  if (result === 0) {
    return 0;
  }

  // localeCompare sorts '-' after end-of-string, so reverse the result when
  // both share MAJOR.MINOR.PATCH and exactly one has a prerelease tag.
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

/**
 * Check if a is strictly greater than b ('a' is ahead of 'b'). Returns false
 * if either is 'unknown' or incomparable (non-semver).
 */
export const isVersionGt = (a: string, b: string): boolean => compareVersions(a, b) === 1;
