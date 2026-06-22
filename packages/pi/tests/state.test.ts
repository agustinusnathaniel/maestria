import { describe, it, expect } from 'vite-plus/test';
import { createInitialState } from '../src/state.js';
import type { MaestriaState } from '../src/state.js';

describe('createInitialState', () => {
  it('should return mode: null', () => {
    const state = createInitialState();
    expect(state.mode).toBeNull();
  });

  it('should return a state object with the correct shape', () => {
    const state = createInitialState();
    const keys = Object.keys(state) as Array<keyof MaestriaState>;
    expect(keys).toEqual(['mode']);
    expect(typeof state.mode === 'string' || state.mode === null).toBe(true);
  });

  it('calling it multiple times returns fresh objects', () => {
    const state1 = createInitialState();
    const state2 = createInitialState();
    expect(state1).not.toBe(state2);
    expect(state1).toEqual(state2);
  });
});
