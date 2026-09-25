import {
  createReviewApi,
  restoreOriginalState as restoreCore,
} from '@maestria/shared-pi/review-core';
import type { ReviewModelContext } from '@maestria/shared-pi/review-core';
import type { MaestriaState } from '@maestria/shared-pi/state-core';
import type { ExtensionAPI } from '@oh-my-pi/pi-coding-agent';

import { isOmpModel } from '@/model.js';

export const restoreOriginalState = async (
  pi: Pick<ExtensionAPI, 'setActiveTools' | 'setModel'>,
  ctx: ReviewModelContext,
  state: MaestriaState,
): Promise<boolean> => {
  const restored = await restoreCore(createReviewApi(pi, isOmpModel), ctx, state);
  return restored;
};
