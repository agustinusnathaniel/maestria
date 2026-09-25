/**
 * Shared review-mode orchestration for Maestria platform packages.
 *
 * Pure TypeScript - no platform-specific dependencies.
 * Consumed by both @maestria/omp and @maestria/pi to eliminate duplication
 * of review-mode model/tool restoration and switching.
 *
 * @module
 */

import type { MaestriaState } from './state-core.js';
import { exitReviewMode } from './state-core.js';

// ── Duck-typed platform interfaces ──

interface ReviewPi {
  setActiveTools: (tools: string[]) => unknown;
  setModel: (model: unknown) => unknown;
}

/**
 * Host-neutral review-model context shared by the pi/omp thin shims
 * (both hosts expose the same registry-read and notify surface).
 */
export interface ReviewModelContext {
  modelRegistry: { getAll: () => { id: string }[] };
  ui: { notify: (msg: string) => void };
}

/**
 * Bind a platform host to the review-mode model/tool API.
 *
 * `isModel` is the platform's model guard; a model is passed to the host
 * only when the guard accepts it, keeping host-specific validation at the
 * platform seam.
 */
export const createReviewApi = <Model>(
  pi: {
    setActiveTools: (tools: string[]) => void | Promise<void>;
    setModel: (model: Model) => Promise<unknown>;
  },
  isModel: (value: unknown) => value is Model,
): ReviewPi => ({
  setActiveTools: (tools): void | Promise<void> => pi.setActiveTools(tools),
  setModel: async (model) => {
    if (isModel(model)) {
      return await pi.setModel(model);
    }
    return null;
  },
});

export const restoreOriginalState = async (
  pi: ReviewPi,
  ctx: ReviewModelContext,
  state: MaestriaState,
): Promise<boolean> => {
  const { state: clearedState, originalModel, originalTools } = exitReviewMode(state);

  if (originalModel !== undefined && originalModel !== null && originalModel !== '') {
    try {
      const models = ctx.modelRegistry.getAll();
      const model = models.find((candidate: { id: string }) => candidate.id === originalModel);
      if (model === undefined || (await pi.setModel(model)) !== true) {
        return false;
      }
    } catch {
      return false;
    }
  }

  if (originalTools !== null) {
    const toolsRestored = await pi.setActiveTools(originalTools);
    if (toolsRestored === false) {
      return false;
    }
  }

  Object.assign(state, clearedState);
  return true;
};

export const cycleToReviewModel = async (
  pi: ReviewPi,
  ctx: ReviewModelContext,
  state: MaestriaState,
): Promise<string | null> => {
  const { reviewModel } = state;
  if (reviewModel === undefined || reviewModel === null || reviewModel === '') {
    return null;
  }
  try {
    const models = ctx.modelRegistry.getAll();
    const model = models.find((m) => m.id === reviewModel);
    if (model) {
      const switched = await pi.setModel(model);
      if (switched !== true) {
        ctx.ui.notify(`Could not activate review model "${reviewModel}", staying on current.`);
        return null;
      }
      return reviewModel;
    }
    ctx.ui.notify(`Review model "${reviewModel}" not found in registry, staying on current.`);
    return null;
  } catch {
    ctx.ui.notify(`Could not switch to review model "${reviewModel}", staying on current.`);
    return null;
  }
};
