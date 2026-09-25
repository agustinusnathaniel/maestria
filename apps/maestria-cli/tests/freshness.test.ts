import { describe, expect, it } from 'vite-plus/test';

import { checkExitCode, freshnessOf, needsUpdateOf } from '@/lib/freshness.js';

describe('freshnessOf', () => {
  it('classifies outdated, current, newer-than-latest, and unknown', () => {
    expect(freshnessOf('0.9.0', '0.10.1')).toBe('outdated');
    expect(freshnessOf('1.0.0', '1.1.0')).toBe('outdated');
    expect(freshnessOf('1.0.0-alpha', '1.0.0')).toBe('outdated');
    expect(freshnessOf('0.10.1', '0.10.1')).toBe('current');
    expect(freshnessOf('2.0.0', '1.9.9')).toBe('current');
    expect(freshnessOf('0.10.1', '')).toBe('unknown');
    expect(freshnessOf('0.10.1', 'see GitHub releases')).toBe('unknown');
    expect(freshnessOf('unknown', '0.10.1')).toBe('unknown');
  });
});

describe('needsUpdateOf', () => {
  it('flags only installs strictly behind a comparable latest', () => {
    expect(needsUpdateOf('0.1.0', '0.2.0')).toBe(true);
    expect(needsUpdateOf('1.0.0-alpha', '1.0.0')).toBe(true);
    expect(needsUpdateOf('0.99.0', '0.2.0')).toBe(false);
    expect(needsUpdateOf('2.0.0', '1.9.9')).toBe(false);
    expect(needsUpdateOf('0.10.1', '0.10.1')).toBe(false);
    expect(needsUpdateOf('unknown', '0.10.1')).toBe(false);
    expect(needsUpdateOf('0.10.1', '')).toBe(false);
    expect(needsUpdateOf('0.10.1', 'see GitHub releases')).toBe(false);
  });
});

describe('checkExitCode', () => {
  it('maps installed state and freshness to 0, 1, or 3', () => {
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
