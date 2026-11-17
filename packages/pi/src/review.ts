import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

import { isPiModel } from '@/model.js';
import { exitReviewMode } from '@/state.js';
import type { MaestriaState } from '@/state.js';

export type ReviewHost = Pick<ExtensionAPI, 'setActiveTools' | 'setModel'>;

export interface ReviewModelContext {
  modelRegistry: { getAll: () => { id: string }[] };
  ui: { notify: (msg: string) => void };
}

/** Switches to the registered model `id`: undefined when it is not registered. */
const switchModel = async (
  pi: ReviewHost,
  ctx: ReviewModelContext,
  id: string,
): Promise<boolean | undefined> => {
  const model = ctx.modelRegistry.getAll().find((candidate) => candidate.id === id);
  if (model === undefined) {
    return undefined;
  }
  return isPiModel(model) && (await pi.setModel(model));
};

export const restoreOriginalState = async (
  pi: ReviewHost,
  ctx: ReviewModelContext,
  state: MaestriaState,
): Promise<boolean> => {
  const { state: clearedState, originalModel, originalTools } = exitReviewMode(state);
  if (originalModel !== null && originalModel !== '') {
    try {
      if ((await switchModel(pi, ctx, originalModel)) !== true) {
        return false;
      }
    } catch {
      return false;
    }
  }
  if (originalTools !== null) {
    pi.setActiveTools(originalTools);
  }
  Object.assign(state, clearedState);
  return true;
};

export const cycleToReviewModel = async (
  pi: ReviewHost,
  ctx: ReviewModelContext,
  state: MaestriaState,
): Promise<string | null> => {
  const { reviewModel } = state;
  if (reviewModel === null || reviewModel === '') {
    return null;
  }
  try {
    const switched = await switchModel(pi, ctx, reviewModel);
    if (switched === true) {
      return reviewModel;
    }
    ctx.ui.notify(
      switched === undefined
        ? `Review model "${reviewModel}" not found in registry, staying on current.`
        : `Could not activate review model "${reviewModel}", staying on current.`,
    );
  } catch {
    ctx.ui.notify(`Could not switch to review model "${reviewModel}", staying on current.`);
  }
  return null;
};
