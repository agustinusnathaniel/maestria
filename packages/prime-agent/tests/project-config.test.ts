// Thin adapter suite: the full loader contract (order, skip, escape, rel-only
// diagnostics) lives once in packages/shared/pi/tests/project-config.test.ts.
// This file pins the prime host delta: the error banner. Handler never-throw
// and order-through-handler stay pinned in modes.test.ts ("thin handler pin").

import { describe, expect, it } from 'vite-plus/test';

import { formatProjectErrorBanner } from '@/project-config.ts';

describe('prime project-config scope contract (thin: error banner)', () => {
  it('formats error banners with STOP', () => {
    expect(formatProjectErrorBanner('[maestria] broken')).toContain('STOP');
  });
});
