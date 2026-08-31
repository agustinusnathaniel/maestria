/**
 * OMP platform compaction handlers.
 *
 * Thin wrapper around the shared implementation in
 * @maestria/shared-pi/compaction-core.
 *
 * @module
 */

import { installCompactionHandlers as installHandlers } from '@maestria/shared-pi/compaction-core';
import type { ExtensionAPI } from '@oh-my-pi/pi-coding-agent';

import type { MaestriaState } from '@/state.js';

/**
 * Install session compaction and tree event handlers for OMP.
 * Delegates to the shared implementation which is duck-type compatible
 * with OMP's ExtensionAPI.
 */
export function installCompactionHandlers(pi: ExtensionAPI, state: MaestriaState): void {
  // Bridge: ExtensionAPI.on has overloaded event types incompatible with
  // the duck-typed { on: (event: string, handler) => void } in the shared
  // module. The as-never cast is safe at runtime - both SDKs share the same
  // event shapes.
  installHandlers(
    {
      on: (event, handler) => {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: narrow from unknown/union via runtime check, safe type assertion
        pi.on(event as never, handler as never);
      },
    },
    state,
  );
}
