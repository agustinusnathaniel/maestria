import { describe, expect, it } from 'vite-plus/test';

import { isPiModel } from '@/model.js';

const createModel = (id: string) => ({
  api: 'anthropic-messages' as const,
  baseUrl: 'https://api.anthropic.com',
  contextWindow: 200_000,
  cost: { cacheRead: 0, cacheWrite: 0, input: 0, output: 0 },
  id,
  input: ['text' as const],
  maxTokens: 4096,
  name: id,
  provider: 'anthropic',
  reasoning: false,
});

describe('isPiModel', () => {
  it('accepts a model with the pi model shape', () => {
    expect(isPiModel(createModel('gpt-4o'))).toBe(true);
  });

  it('rejects values that are not pi models', () => {
    expect(isPiModel(null)).toBe(false);
    expect(isPiModel({ id: 'gpt-4o' })).toBe(false);
  });
});
