import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import {
  createReviewApi,
  restoreOriginalState as restoreCore,
} from '@maestria/shared-pi/review-core';
import type { ReviewModelContext } from '@maestria/shared-pi/review-core';
import type { MaestriaState } from '@maestria/shared-pi/state-core';

import { isPiModel } from '@/model.js';

export type { ReviewModelContext } from '@maestria/shared-pi/review-core';

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
  await restoreCore(createReviewApi(pi, isPiModel), ctx, state);
};
