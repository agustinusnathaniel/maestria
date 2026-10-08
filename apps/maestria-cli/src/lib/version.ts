import compare from 'semver/functions/compare.js';
import valid from 'semver/functions/valid.js';

const isSemver = (v: string): boolean => /^\d/u.test(v) && v.trim() === v && valid(v) !== null;

export const isValidVersion = (v: string): boolean => v === 'latest' || v === '' || isSemver(v);

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
  return isSemver(a) && isSemver(b) ? compare(a, b) : null;
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
