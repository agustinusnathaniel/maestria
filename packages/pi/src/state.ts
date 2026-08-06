/**
 * Maestria state management — consolidated barrel.
 *
 * Types, transforms, persistence, and render logic are shared between
 * omp and pi via @maestria/shared-pi/state-core. Only the review-mode
 * orchestration lives in ./state/review.js since it depends on platform-specific
 * ExtensionAPI types.
 */
/* eslint-disable @typescript-eslint/no-unused-vars -- barrel re-exports are intentionally unused */
export type {
  MaestriaState,
  LandingReviewPhase,
  LandingReviewBinding,
  LandingReviewVerdict,
  HandoffEntry,
  SubagentStatusInfo,
} from '@maestria/shared-pi/state-core';
export {
  HANDOFF_HISTORY_CAP,
  FILE_HISTORY_CAP,
  LANDING_REVIEW_VERDICT_INSTRUCTIONS,
} from '@maestria/shared-pi/state-core';
export {
  createInitialState,
  recordHandoff,
  recordFileModified,
  recordFileRead,
  recordSubagentStatus,
  setReviewMode,
  resetLandingReview,
  armLandingReview,
  beginLandingReview,
  markLandingReviewFailed,
  markLandingReviewStale,
  markLandingReviewShippingStarted,
  recordLandingReviewVerdict,
  validateLandingReviewVerdict,
  exitReviewMode,
  persistState,
  renderMaestriaSummary,
} from '@maestria/shared-pi/state-core';
export { restoreOriginalState, cycleToReviewModel } from './state/review.js';
