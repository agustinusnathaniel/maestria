import type { ExtensionAPI, ExtensionCommandContext } from '@earendil-works/pi-coding-agent';
import type { MaestriaState } from './types.js';
import { exitReviewMode } from './transforms.js';

export async function restoreOriginalState(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  state: MaestriaState,
): Promise<void> {
  const { state: clearedState, originalModel, originalTools } = exitReviewMode(state);

  if (originalTools && originalTools.length > 0) {
    pi.setActiveTools(originalTools);
  }

  if (originalModel) {
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
}

export async function cycleToReviewModel(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  state: MaestriaState,
): Promise<string | null> {
  const reviewModel = state.reviewModel;
  if (!reviewModel) {
    return null;
  }
  try {
    const models = ctx.modelRegistry.getAll();
    const model = models.find((m) => m.id === reviewModel);
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
