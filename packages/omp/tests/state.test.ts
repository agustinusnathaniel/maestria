import { describe, expect, it } from 'vite-plus/test';

import { isOmpModel } from '@/model.js';
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

describe('state barrel', () => {
  it('re-exports the shared state API and the omp restore helper', () => {
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
