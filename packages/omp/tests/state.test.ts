import { describe, expect, it } from 'vite-plus/test';

import { isOmpModel } from '@/model.js';
import {
  createInitialState,
  FILE_HISTORY_CAP,
  HANDOFF_HISTORY_CAP,
  renderMaestriaSummary,
} from '@maestria/shared-pi/state-core';

describe('state modules', () => {
  it('pins the shared history caps', () => {
    expect(HANDOFF_HISTORY_CAP).toBe(5);
    expect(FILE_HISTORY_CAP).toBe(10);
  });

  it('serves shared initial state', () => {
    const state = createInitialState();

    expect(state.mode).toBeNull();
    expect(state.handoffHistory).toEqual([]);
    expect(state.reviewMode).toBe(false);
    expect(state.nativeGoal).toBeNull();
  });
});

describe('isOmpModel', () => {
  it('accepts objects carrying a string model id', () => {
    expect(isOmpModel({ id: 'gpt-4o' })).toBe(true);
  });

  it('rejects values without a string model id', () => {
    expect(isOmpModel(null)).toBe(false);
    expect(isOmpModel({})).toBe(false);
    expect(isOmpModel({ id: 7 })).toBe(false);
  });
});

describe('renderMaestriaSummary with nativeGoal', () => {
  it('includes the native goal section when a native goal is mirrored', () => {
    const state = {
      ...createInitialState(),
      nativeGoal: { objective: 'Ship the feature', status: 'active' },
    };

    expect(renderMaestriaSummary(state)).toContain('**Native Goal:** Ship the feature (active)');
  });

  it('omits the native goal section when no native goal is mirrored', () => {
    expect(renderMaestriaSummary(createInitialState())).not.toContain('**Native Goal:**');
  });
});
