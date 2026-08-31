import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import {
  cycleToReviewModel as cycleCore,
  restoreOriginalState as restoreCore,
} from '@maestria/shared-pi/review-core';
import type { MaestriaState } from '@maestria/shared-pi/state-core';

type PiModel = Parameters<ExtensionAPI['setModel']>[0];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isPiModel = (value: unknown): value is PiModel => {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.api === 'string' &&
    typeof value.baseUrl === 'string' &&
    typeof value.contextWindow === 'number' &&
    typeof value.cost === 'object' &&
    value.cost !== null &&
    typeof value.id === 'string' &&
    Array.isArray(value.input) &&
    typeof value.maxTokens === 'number' &&
    typeof value.name === 'string' &&
    typeof value.provider === 'string' &&
    typeof value.reasoning === 'boolean'
  );
};

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
  await restoreCore(
    {
      setActiveTools: (tools) => {
        pi.setActiveTools(tools);
      },
      setModel: async (model) => {
        if (isPiModel(model)) {
          await pi.setModel(model);
        }
      },
    },
    ctx,
    state,
  );
};

export const cycleToReviewModel = async (
  pi: ReviewApi,
  ctx: ReviewModelContext,
  state: MaestriaState,
): Promise<string | null> =>
  await cycleCore(
    {
      setActiveTools: (tools) => {
        pi.setActiveTools(tools);
      },
      setModel: async (model) => {
        if (isPiModel(model)) {
          await pi.setModel(model);
        }
      },
    },
    ctx,
    state,
  );
