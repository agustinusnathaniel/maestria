import { describe, it, expect } from 'vite-plus/test';
import {
  compareVersions,
  isValidVersion,
  isVersionEq,
  isVersionDifferent,
  isVersionGt,
} from '@/lib/version.js';

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

describe('isVersionGt', () => {
  it('reports an install ahead of the registry as greater', () => {
    expect(isVersionGt('0.11.0', '0.10.1')).toBe(true);
  });

  it('returns false for equal versions', () => {
    expect(isVersionGt('0.10.1', '0.10.1')).toBe(false);
  });

  it('applies semver prerelease ordering (prerelease < release)', () => {
    expect(isVersionGt('1.0.0', '1.0.0-alpha')).toBe(true);
  });

  it('returns false when the installed version is unknown', () => {
    expect(isVersionGt('unknown', '0.10.1')).toBe(false);
  });

  it('returns false for an empty (incomparable) version', () => {
    expect(isVersionGt('0.10.1', '')).toBe(false);
  });
});

describe('semver regression - hyphen prerelease and underscore rejection', () => {
  it('accepts prerelease with hyphen (alpha-1) as valid', () => {
    expect(isValidVersion('1.0.0-alpha-1')).toBe(true);
    expect(isValidVersion('1.0.0-alpha-1+build.1')).toBe(true);
  });

  it('compares prerelease with hyphen correctly (prerelease < release)', () => {
    expect(compareVersions('1.0.0-alpha-1', '1.0.0')).toBe(-1);
    expect(isVersionGt('1.0.0', '1.0.0-alpha-1')).toBe(true);
  });

  it('rejects underscore in prerelease (invalid per semver)', () => {
    expect(isValidVersion('1.0.0-alpha_1')).toBe(false);
    expect(compareVersions('1.0.0-alpha_1', '1.0.0')).toBe(null);
  });

  it('rejects underscore in build metadata', () => {
    expect(isValidVersion('1.0.0+build_1')).toBe(false);
  });
});

describe('semver regression - build metadata ignored for precedence', () => {
  it('treats 1.0.0+build.1 as equal to 1.0.0', () => {
    expect(compareVersions('1.0.0+build.1', '1.0.0')).toBe(0);
    expect(isVersionEq('1.0.0+build.1', '1.0.0')).toBe(true);
    expect(isVersionDifferent('1.0.0+build.1', '1.0.0')).toBe(false);
  });

  it('treats different build metadata as equal', () => {
    expect(compareVersions('1.0.0+build.1', '1.0.0+build.2')).toBe(0);
    expect(isVersionEq('1.0.0+build.1', '1.0.0+build.2')).toBe(true);
    expect(isVersionDifferent('1.0.0+build.1', '1.0.0+build.2')).toBe(false);
  });

  it('ignores build metadata when prerelease is present', () => {
    expect(compareVersions('1.0.0-alpha+build.1', '1.0.0-alpha+build.2')).toBe(0);
    expect(compareVersions('1.0.0-alpha+build.1', '1.0.0-alpha')).toBe(0);
  });

  it('keeps prerelease < release ordering even with hyphen handling', () => {
    expect(compareVersions('1.0.0-alpha', '1.0.0')).toBe(-1);
    expect(compareVersions('1.0.0-alpha-1', '1.0.0')).toBe(-1);
  });
});
