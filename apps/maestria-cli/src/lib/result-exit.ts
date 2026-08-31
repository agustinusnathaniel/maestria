import type { PlatformResult } from '@/types.js';

/**
 * Exit code for a batch of per-platform results: 0 when every result
 * succeeded (or the batch is empty), 1 when any result failed.
 *
 * Mirrors the documented CLI exit-code contract (0 = success, 1 = command
 * error) so install/update/uninstall expose partial failures to CI and
 * AI-agent consumers instead of always exiting 0.
 */
export const exitCodeForResults = (results: PlatformResult[]): number =>
  results.every((r) => r.ok) ? 0 : 1;
