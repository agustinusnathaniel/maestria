import { describe, expect, it } from 'vite-plus/test';

import { exitCodeForResults } from '@/lib/result-exit.js';
import type { PlatformResult } from '@/types.js';

function result(ok: boolean): PlatformResult {
  return { id: 'pi', label: 'Pi', message: ok ? 'ok' : 'failed', ok };
}

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

  it('returns 0 when one result is Already up to date (ok:true with prevVersion/nextVersion)', () => {
    const upToDate: PlatformResult = {
      id: 'pi',
      label: 'Pi',
      message: 'Already up to date',
      nextVersion: '0.2.0',
      ok: true,
      prevVersion: '0.2.0',
    };
    expect(exitCodeForResults([upToDate])).toBe(0);
    expect(exitCodeForResults([result(true), upToDate])).toBe(0);
  });
});
