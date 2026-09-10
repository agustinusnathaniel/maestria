/**
 * Pi platform compaction handlers.
 *
 * Thin wrapper around the shared compaction-core implementation.
 *
 * @module
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { installCompactionHandlers as installHandlers } from '@maestria/shared-pi/compaction-core';
import type { MaestriaState } from '@maestria/shared-pi/state-core';

/**
 * Install session compaction and tree event handlers for Pi.
 */
export const installCompactionHandlers = (pi: ExtensionAPI, state: MaestriaState): void => {
  installHandlers(pi, state);
};
