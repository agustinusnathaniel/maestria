import { describe, expect, it } from 'vite-plus/test';

import { exitCodeForResults } from '@/lib/command-result.js';
import type { PlatformResult } from '@/types.js';

const result = (ok: boolean): PlatformResult => ({
  id: 'pi',
  label: 'Pi',
  message: ok ? 'ok' : 'failed',
  ok,
});

describe('exitCodeForResults', () => {
  it('returns 0 for an empty results array', () => {
    expect(exitCodeForResults([])).toBe(0);
  });

  it('returns 0 when every result is ok:true', () => {
    expect(exitCodeForResults([result(true), result(true), result(true)])).toBe(0);
  });

  it('returns 1 when a single result is ok:false', () => {
    expect(exitCodeForResults([result(false)])).toBe(1);
  });

  it('returns 1 when a mix of ok:true and ok:false results exists', () => {
    expect(exitCodeForResults([result(true), result(false), result(true)])).toBe(1);
  });
});
