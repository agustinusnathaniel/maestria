import {
  createReviewApi,
  cycleToReviewModel as cycleCore,
  restoreOriginalState as restoreCore,
} from '@maestria/shared-pi/review-core';
import type { MaestriaState } from '@maestria/shared-pi/state-core';
import type { ExtensionAPI } from '@oh-my-pi/pi-coding-agent';

import { isOmpModel } from '@/model.js';

export interface ReviewModelContext {
  modelRegistry: { getAll: () => { id: string }[] };
  ui: { notify: (message: string) => void };
}

export interface ReviewModelApi {
  setActiveTools: ExtensionAPI['setActiveTools'];
  setModel: ExtensionAPI['setModel'];
}

export type ReviewApi = ReviewModelApi;

export const restoreOriginalState = async (
  pi: ReviewApi,
  ctx: ReviewModelContext,
  state: MaestriaState,
): Promise<void> => {
  await restoreCore(createReviewApi(pi, isOmpModel), ctx, state);
};

export const cycleToReviewModel = async (
  pi: ReviewApi,
  ctx: ReviewModelContext,
  state: MaestriaState,
): Promise<string | null> => await cycleCore(createReviewApi(pi, isOmpModel), ctx, state);
