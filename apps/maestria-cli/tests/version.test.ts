import { describe, expect, it } from 'vite-plus/test';

import { compareVersions, isValidVersion, isVersionEq, isVersionGt } from '@/lib/version.js';

describe('compareVersions', () => {
  it('handles sentinels, numeric segments, prerelease, and latest', () => {
    expect(compareVersions('0.1.13', 'see GitHub releases')).toBe(null);
    expect(compareVersions('see GitHub releases', '0.1.13')).toBe(null);
    expect(compareVersions('0.10.0', '0.9.0')).toBe(1);
    expect(compareVersions('1.0.0-alpha', '1.0.0')).toBe(-1);
    expect(compareVersions('latest', '1.0.0')).toBe(1);
  });
});

describe('isVersionEq', () => {
  it('handles sentinels and latest equality', () => {
    expect(isVersionEq('0.1.13', 'see GitHub releases')).toBe(false);
    expect(isVersionEq('latest', 'latest')).toBe(true);
  });
});

describe('isVersionGt', () => {
  it('reports ahead-of-registry installs with prerelease and unknown handling', () => {
    expect(isVersionGt('0.11.0', '0.10.1')).toBe(true);
    expect(isVersionGt('0.10.1', '0.10.1')).toBe(false);
    expect(isVersionGt('1.0.0', '1.0.0-alpha')).toBe(true);
    expect(isVersionGt('unknown', '0.10.1')).toBe(false);
    expect(isVersionGt('0.10.1', '')).toBe(false);
  });
});

describe('semver regression - hyphen prerelease and underscore rejection', () => {
  it('accepts hyphen prereleases, compares them, and rejects underscores', () => {
    expect(isValidVersion('1.0.0-alpha-1')).toBe(true);
    expect(isValidVersion('1.0.0-alpha-1+build.1')).toBe(true);
    expect(compareVersions('1.0.0-alpha-1', '1.0.0')).toBe(-1);
    expect(isVersionGt('1.0.0', '1.0.0-alpha-1')).toBe(true);
    expect(isValidVersion('1.0.0-alpha_1')).toBe(false);
    expect(compareVersions('1.0.0-alpha_1', '1.0.0')).toBe(null);
    expect(isValidVersion('1.0.0+build_1')).toBe(false);
  });
});

describe('semver regression - build metadata ignored for precedence', () => {
  it('ignores build metadata while keeping prerelease ordering', () => {
    expect(compareVersions('1.0.0+build.1', '1.0.0')).toBe(0);
    expect(isVersionEq('1.0.0+build.1', '1.0.0')).toBe(true);
  });

  it('treats different build metadata as equal', () => {
    expect(compareVersions('1.0.0+build.1', '1.0.0+build.2')).toBe(0);
    expect(isVersionEq('1.0.0+build.1', '1.0.0+build.2')).toBe(true);
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
