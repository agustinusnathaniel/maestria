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
  setActiveTools(tools: string[]): void | Promise<void>;
  setModel(model: unknown): void | Promise<void>;
}

interface ReviewCtx {
  modelRegistry: { getAll(): Array<{ id: string }> };
  ui: { notify(msg: string): void };
}

export async function restoreOriginalState(
  pi: ReviewPi,
  ctx: ReviewCtx,
  state: MaestriaState,
): Promise<void> {
  const { state: clearedState, originalModel, originalTools } = exitReviewMode(state);

  if (originalTools && originalTools.length > 0) {
    await pi.setActiveTools(originalTools);
  }

  if (originalModel) {
    try {
      const models = ctx.modelRegistry.getAll();
      const model = models.find((m: { id: string }) => {
        return m.id === originalModel;
      });
      if (model) {
        await pi.setModel(model);
      }
    } catch {
      // Best-effort: model restoration is non-critical
    }
  }

  Object.assign(state, clearedState);
}

export async function cycleToReviewModel(
  pi: ReviewPi,
  ctx: ReviewCtx,
  state: MaestriaState,
): Promise<string | null> {
  const reviewModel = state.reviewModel;
  if (!reviewModel) {
    return null;
  }
  try {
    const models = ctx.modelRegistry.getAll();
    const model = models.find((m) => {
      return m.id === reviewModel;
    });
    if (model) {
      await pi.setModel(model);
      return reviewModel;
    } else {
      ctx.ui.notify(`Review model "${reviewModel}" not found in registry, staying on current.`);
      return null;
    }
  } catch {
    ctx.ui.notify(`Could not switch to review model "${reviewModel}", staying on current.`);
    return null;
  }
}
