import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

type PiModel = Parameters<ExtensionAPI['setModel']>[0];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const isPiModel = (value: unknown): value is PiModel => {
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
