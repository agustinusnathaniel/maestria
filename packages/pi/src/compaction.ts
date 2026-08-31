/**
 * Pi platform compaction handlers.
 *
 * Thin wrapper around the shared compaction-core implementation.
 *
 * @module
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { installCompactionHandlers as installHandlers } from '@maestria/shared-pi/compaction-core';
import type {
  CompactionEvent,
  CompactionPi,
  CompactionResult,
  TreeEvent,
  TreeResult,
} from '@maestria/shared-pi/compaction-core';

import type { MaestriaState } from '@/state.js';

/**
 * Install session compaction and tree event handlers for Pi.
 * Delegates to the shared implementation which is duck-type compatible
 * with Pi's ExtensionAPI.
 */
export const createCompactionApi = (pi: ExtensionAPI): CompactionPi => {
  const on = (
    ...args:
      | ['session_before_compact', (event: CompactionEvent) => CompactionResult]
      | ['session_before_tree', (event: TreeEvent) => TreeResult | undefined]
  ): void => {
    const [event, handler] = args;
    if (event === 'session_before_compact') {
      pi.on('session_before_compact', (eventData) => handler(eventData));
    }
    if (event === 'session_before_tree') {
      pi.on('session_before_tree', (eventData) => handler(eventData));
    }
  };
  return { on };
};

export const installCompactionHandlers = (pi: CompactionPi, state: MaestriaState): void => {
  installHandlers(pi, state);
};
