import { describe, it, expect } from 'vite-plus/test';
import { checkExitCode, freshnessOf } from '@/lib/freshness.js';

describe('freshnessOf', () => {
  it('flags older installed versions as outdated', () => {
    expect(freshnessOf('0.9.0', '0.10.1')).toBe('outdated');
    expect(freshnessOf('1.0.0', '1.1.0')).toBe('outdated');
  });

  it('applies semver prerelease ordering', () => {
    expect(freshnessOf('1.0.0-alpha', '1.0.0')).toBe('outdated');
  });

  it('treats equal versions as current', () => {
    expect(freshnessOf('0.10.1', '0.10.1')).toBe('current');
  });

  it('never flags an installed version newer than latest as outdated', () => {
    expect(freshnessOf('2.0.0', '1.9.9')).toBe('current');
  });

  it('returns unknown when the latest version is missing or opaque', () => {
    expect(freshnessOf('0.10.1', '')).toBe('unknown');
    expect(freshnessOf('0.10.1', 'see GitHub releases')).toBe('unknown');
  });

  it('returns unknown when the installed version is unknown', () => {
    expect(freshnessOf('unknown', '0.10.1')).toBe('unknown');
  });
});

describe('checkExitCode', () => {
  it('exits 1 when the plugin is not installed', () => {
    expect(checkExitCode('outdated', false)).toBe(1);
    expect(checkExitCode('current', false)).toBe(1);
  });

  it('exits 0 when installed and current or incomparable', () => {
    expect(checkExitCode('current', true)).toBe(0);
    expect(checkExitCode('unknown', true)).toBe(0);
  });

  it('exits 3 when installed but outdated', () => {
    expect(checkExitCode('outdated', true)).toBe(3);
  });
});
