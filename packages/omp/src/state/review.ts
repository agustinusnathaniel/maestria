import type {
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
} from '@oh-my-pi/pi-coding-agent';
import type { MaestriaState } from '@maestria/shared-pi/state-core';
import {
  cycleToReviewModel as cycleCore,
  restoreOriginalState as restoreCore,
} from '@maestria/shared-pi/review-core';

export async function restoreOriginalState(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  state: MaestriaState,
): Promise<void> {
  await restoreCore(pi as never, ctx, state);
}

export async function cycleToReviewModel(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  state: MaestriaState,
): Promise<string | null> {
  return await cycleCore(pi as never, ctx, state);
}
