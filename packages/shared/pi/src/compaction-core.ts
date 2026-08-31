/**
 * Shared compaction handlers for Maestria platform packages.
 *
 * Pure TypeScript - no platform-specific dependencies.
 * Imported by both @maestria/omp and @maestria/pi to eliminate duplication.
 *
 * @module
 */

import { renderMaestriaSummary } from './state-core.js';
import type { MaestriaState } from './state-core.js';

export interface CompactionEvent {
  preparation?: {
    firstKeptEntryId?: string;
    tokensBefore?: number;
  };
}

export interface TreeEvent {
  preparation?: {
    userWantsSummary?: boolean;
  };
}

export interface CompactionResult {
  compaction?: {
    details?: unknown;
    firstKeptEntryId: string;
    summary: string;
    tokensBefore: number;
  };
}

export interface TreeResult {
  summary?: {
    summary: string;
  };
}

export type CompactionOn = (
  ...args:
    | ['session_before_compact', (event: CompactionEvent) => CompactionResult]
    | ['session_before_tree', (event: TreeEvent) => TreeResult | undefined]
) => void;

export interface CompactionPi {
  on: CompactionOn;
}

/**
 * Install handlers for session compaction and tree events to persist
 * and restore maestria state across session compaction boundaries.
 */
export const installCompactionHandlers = (pi: CompactionPi, state: MaestriaState): void => {
  pi.on('session_before_compact', (event: CompactionEvent) => {
    const prep = event.preparation;
    return {
      compaction: {
        details: { ...state },
        firstKeptEntryId: prep?.firstKeptEntryId ?? '',
        summary: renderMaestriaSummary(state),
        tokensBefore: prep?.tokensBefore ?? 0,
      },
    };
  });

  pi.on('session_before_tree', (event: TreeEvent) => {
    const prep = event.preparation;
    return prep?.userWantsSummary === true
      ? {
          summary: {
            summary: renderMaestriaSummary(state),
          },
        }
      : undefined;
  });
};
