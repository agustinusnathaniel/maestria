import {
  createReviewApi,
  restoreOriginalState as restoreCore,
} from '@maestria/shared-pi/review-core';
import type { ReviewModelContext } from '@maestria/shared-pi/review-core';
import type { MaestriaState } from '@maestria/shared-pi/state-core';
import type { ExtensionAPI } from '@oh-my-pi/pi-coding-agent';

import { isOmpModel } from '@/model.js';

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
): Promise<boolean> => await restoreCore(createReviewApi(pi, isOmpModel), ctx, state);
