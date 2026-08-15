import { describe, it, expect } from 'vite-plus/test';
import { compareVersions, isVersionEq, isVersionDifferent } from '@/lib/version.js';

describe('compareVersions', () => {
  it('treats non-semver display sentinels as incomparable', () => {
    expect(compareVersions('0.1.13', 'see GitHub releases')).toBe(null);
    expect(compareVersions('see GitHub releases', '0.1.13')).toBe(null);
  });

  it('orders numeric segments numerically', () => {
    expect(compareVersions('0.10.0', '0.9.0')).toBe(1);
  });

  it('orders prerelease before release for the same version', () => {
    expect(compareVersions('1.0.0-alpha', '1.0.0')).toBe(-1);
  });

  it('treats latest as greater than any semver version', () => {
    expect(compareVersions('latest', '1.0.0')).toBe(1);
  });
});

describe('isVersionDifferent', () => {
  it('does not flag a non-semver latest as needing an update', () => {
    expect(isVersionDifferent('0.1.13', 'see GitHub releases')).toBe(false);
  });

  it('returns false for equal versions', () => {
    expect(isVersionDifferent('0.2.0', '0.2.0')).toBe(false);
  });

  it('returns true for different versions', () => {
    expect(isVersionDifferent('0.2.0', '0.3.0')).toBe(true);
  });

  it('returns false when either version is unknown', () => {
    expect(isVersionDifferent('0.2.0', 'unknown')).toBe(false);
  });
});

describe('isVersionEq', () => {
  it('treats a non-semver display sentinel as not equal', () => {
    expect(isVersionEq('0.1.13', 'see GitHub releases')).toBe(false);
  });

  it('returns true for two latest values', () => {
    expect(isVersionEq('latest', 'latest')).toBe(true);
  });
});
