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
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: narrow from unknown/union via runtime check, safe type assertion
  await restoreCore(pi as never, ctx, state);
}

export async function cycleToReviewModel(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  state: MaestriaState,
): Promise<string | null> {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: narrow from unknown/union via runtime check, safe type assertion
  return await cycleCore(pi as never, ctx, state);
}
