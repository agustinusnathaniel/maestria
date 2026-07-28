/**
 * Maestria state management — barrel re-exports.
 *
 * Decomposed into focused sub-modules under src/state/:
 * - types.ts       — Type definitions and constants
 * - transforms.ts  — Pure state transformations (no side effects)
 * - persistence.ts — Session persistence (I/O concern)
 * - review.ts      — Review mode orchestration (async, Pi API-dependent)
 * - render.ts      — Human-readable state rendering
 *
 * Shared code (types, transforms, persistence, render) lives in
 * @maestria/shared-pi/state-core to eliminate duplication between
 * omp and pi packages. Platform-specific code (review.ts) stays local.
 *
 * Consumers can import from the barrel (@/state.js) or from specific sub-modules.
 */
export type { MaestriaState, HandoffEntry, SubagentStatusInfo } from '@maestria/shared-pi/state-core';
export { HANDOFF_HISTORY_CAP, FILE_HISTORY_CAP } from '@maestria/shared-pi/state-core';
export {
  createInitialState,
  recordHandoff,
  recordFileModified,
  recordFileRead,
  recordSubagentStatus,
  setReviewMode,
  exitReviewMode,
} from '@maestria/shared-pi/state-core';
export { persistState } from '@maestria/shared-pi/state-core';
export { restoreOriginalState, cycleToReviewModel } from './state/review.js';
export { renderMaestriaSummary } from '@maestria/shared-pi/state-core';
