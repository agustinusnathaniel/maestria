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
  setActiveTools: (tools: string[]) => void | Promise<void>;
  setModel: (model: unknown) => void | Promise<void>;
}

interface ReviewCtx {
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
      await pi.setModel(model);
    }
  },
});

export const restoreOriginalState = async (
  pi: ReviewPi,
  ctx: ReviewCtx,
  state: MaestriaState,
): Promise<void> => {
  const { state: clearedState, originalModel, originalTools } = exitReviewMode(state);

  if (originalTools && originalTools.length > 0) {
    await pi.setActiveTools(originalTools);
  }

  if (originalModel !== undefined && originalModel !== null && originalModel !== '') {
    try {
      const models = ctx.modelRegistry.getAll();
      const model = models.find((m: { id: string }) => m.id === originalModel);
      if (model) {
        await pi.setModel(model);
      }
    } catch {
      // Best-effort: model restoration is non-critical
    }
  }

  Object.assign(state, clearedState);
};

export const cycleToReviewModel = async (
  pi: ReviewPi,
  ctx: ReviewCtx,
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
      await pi.setModel(model);
      return reviewModel;
    }
    ctx.ui.notify(`Review model "${reviewModel}" not found in registry, staying on current.`);
    return null;
  } catch {
    ctx.ui.notify(`Could not switch to review model "${reviewModel}", staying on current.`);
    return null;
  }
};
