import { describe, expect, it } from 'vite-plus/test';

import { isOmpModel } from '@/model.js';
import { createInitialState, renderMaestriaSummary } from '@maestria/shared-pi/state-core';

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
