/**
 * Shared compaction handlers for Maestria platform packages.
 *
 * Pure TypeScript — no platform-specific dependencies.
 * Imported by both @maestria/omp and @maestria/pi to eliminate duplication.
 *
 * @module
 */

import { renderMaestriaSummary } from './state-core.js';
import type { MaestriaState } from './state-core.js';

/**
 * Install handlers for session compaction and tree events to persist
 * and restore maestria state across session compaction boundaries.
 *
 * Uses duck-typed `pi` parameter — both Pi and OMP ExtensionAPI types
 * satisfy the `{ on(event: string, handler): void }` shape needed here.
 */
export function installCompactionHandlers(
  pi: {
    on: (event: string, handler: (...args: unknown[]) => unknown) => void;
  },
  state: MaestriaState,
): void {
  pi.on('session_before_compact', (event: unknown) => {
    const prep = (event as Record<string, unknown>).preparation as
      | Record<string, unknown>
      | undefined;
    return {
      compaction: {
        summary: renderMaestriaSummary(state),
        details: { ...state },
        firstKeptEntryId: prep?.firstKeptEntryId,
        tokensBefore: prep?.tokensBefore,
      },
    };
  });

  pi.on('session_before_tree', (event: unknown) => {
    const prep = (event as Record<string, unknown>).preparation as
      | Record<string, unknown>
      | undefined;
    if (prep?.userWantsSummary) {
      return {
        summary: {
          summary: renderMaestriaSummary(state),
        },
      };
    }
    return undefined;
  });
}
