/**
 * OMP platform compaction handlers.
 *
 * Thin wrapper around the shared compaction-core implementation.
 *
 * @module
 */

import type { ExtensionAPI } from '@oh-my-pi/pi-coding-agent';
import { installCompactionHandlers as installHandlers } from '@maestria/shared-pi/compaction-core';
import type { MaestriaState } from '@maestria/shared-pi/state-core';

/**
 * Install session compaction and tree event handlers for OMP.
 *
 * The shared tree handler returns `undefined` to decline a summary; OMP reads
 * the result with optional chaining, so that is runtime-identical to the
 * empty object the previous adapter returned.
 */
export const installCompactionHandlers = (pi: ExtensionAPI, state: MaestriaState): void => {
  installHandlers(pi, state);
};
