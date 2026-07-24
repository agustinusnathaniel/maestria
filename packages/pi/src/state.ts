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
 * Re-exports everything for backward compatibility.
 * Consumers can import from the barrel (@/state.js) or from specific sub-modules.
 */

export type { MaestriaState, HandoffEntry, SubagentStatusInfo } from './state/types.js';
export { HANDOFF_HISTORY_CAP, FILE_HISTORY_CAP } from './state/types.js';
export {
  createInitialState,
  recordHandoff,
  recordFileModified,
  recordFileRead,
  recordSubagentStatus,
  setReviewMode,
  exitReviewMode,
} from './state/transforms.js';
export { persistState } from './state/persistence.js';
export { restoreOriginalState, cycleToReviewModel } from './state/review.js';
export { renderMaestriaSummary } from './state/render.js';
