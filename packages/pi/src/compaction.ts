/**
 * Pi platform compaction handlers.
 *
 * Thin wrapper around the shared implementation in
 * @maestria/shared-pi/compaction-core.
 *
 * @module
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { MaestriaState } from '@/state.js';
import { installCompactionHandlers as installHandlers } from '@maestria/shared-pi/compaction-core';

/**
 * Install session compaction and tree event handlers for Pi.
 * Delegates to the shared implementation which is duck-type compatible
 * with Pi's ExtensionAPI.
 */
export function installCompactionHandlers(pi: ExtensionAPI, state: MaestriaState): void {
  // Bridge: ExtensionAPI.on has overloaded event types incompatible with
  // the duck-typed { on: (event: string, handler) => void } in the shared
  // module. The as-never cast is safe at runtime — both SDKs share the same
  // event shapes.
  installHandlers(
    {
      on: (event, handler) => {
        pi.on(event as never, handler as never);
      },
    },
    state,
  );
}
