import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import {
  createReviewApi,
  restoreOriginalState as restoreCore,
} from '@maestria/shared-pi/review-core';
import type { ReviewModelContext } from '@maestria/shared-pi/review-core';
import type { MaestriaState } from '@maestria/shared-pi/state-core';

import { isPiModel } from '@/model.js';

export const restoreOriginalState = async (
  pi: Pick<ExtensionAPI, 'setActiveTools' | 'setModel'>,
  ctx: ReviewModelContext,
  state: MaestriaState,
): Promise<boolean> => {
  const restored = await restoreCore(createReviewApi(pi, isPiModel), ctx, state);
  return restored;
};
