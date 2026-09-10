import { describe, expect, it } from 'vite-plus/test';

import { isPiModel } from '@/model.js';
import {
  createInitialState,
  exitReviewMode,
  FILE_HISTORY_CAP,
  HANDOFF_HISTORY_CAP,
  persistState,
  recordFileModified,
  recordFileRead,
  recordHandoff,
  recordSpecialistDelegated,
  renderMaestriaSummary,
  restoreOriginalState,
} from '@/state.js';

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

describe('state barrel', () => {
  it('re-exports the shared state API and the pi restore helper', () => {
    expect(HANDOFF_HISTORY_CAP).toBe(5);
    expect(FILE_HISTORY_CAP).toBe(10);
    expect(typeof createInitialState).toBe('function');
    expect(typeof recordHandoff).toBe('function');
    expect(typeof recordFileModified).toBe('function');
    expect(typeof recordFileRead).toBe('function');
    expect(typeof recordSpecialistDelegated).toBe('function');
    expect(typeof exitReviewMode).toBe('function');
    expect(typeof persistState).toBe('function');
    expect(typeof renderMaestriaSummary).toBe('function');
    expect(typeof restoreOriginalState).toBe('function');
  });

  it('serves shared initial state through the barrel', () => {
    const state = createInitialState();

    expect(state.mode).toBeNull();
    expect(state.handoffHistory).toEqual([]);
    expect(state.reviewMode).toBe(false);
  });
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
