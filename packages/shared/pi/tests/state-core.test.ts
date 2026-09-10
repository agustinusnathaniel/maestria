import { describe, expect, it, vi } from 'vite-plus/test';

import {
  createInitialState,
  readSessionBranch,
  replaceState,
  stateFromSessionEntries,
} from '../src/state-core.js';
import type { MaestriaState, SessionEntry } from '../src/state-core.js';

// ── readSessionBranch ────────────────────────────────────────────────

describe('readSessionBranch', () => {
  it('returns the branch entries when getBranch returns an array', () => {
    const entries: SessionEntry[] = [{ customType: 'maestria_state', type: 'custom' }];
    const ctx = { sessionManager: { getBranch: vi.fn(() => entries) } };

    expect(readSessionBranch(ctx)).toBe(entries);
  });

  it('returns null when the session manager is missing or not a duck type', () => {
    expect(readSessionBranch()).toBeNull();
    expect(readSessionBranch(null)).toBeNull();
    expect(readSessionBranch({})).toBeNull();
    expect(readSessionBranch({ sessionManager: {} })).toBeNull();
  });

  it('returns null when getBranch returns a non-array', () => {
    const ctx = { sessionManager: { getBranch: () => null } };
    expect(readSessionBranch(ctx)).toBeNull();
  });

  it('never falls back to getEntries, which spans the whole session tree', () => {
    const getEntries = vi.fn(() => [{ customType: 'maestria_state', type: 'custom' }]);
    const ctx = { sessionManager: { getBranch: () => null, getEntries } };

    expect(readSessionBranch(ctx)).toBeNull();
    expect(getEntries).not.toHaveBeenCalled();
  });
});

// ── stateFromSessionEntries ──────────────────────────────────────────

describe('stateFromSessionEntries', () => {
  it('returns the initial state for null or absent entries', () => {
    expect(stateFromSessionEntries(null)).toEqual(createInitialState());
    expect(stateFromSessionEntries()).toEqual(createInitialState());
    expect(stateFromSessionEntries([])).toEqual(createInitialState());
  });

  it('applies the persisted data from a maestria_state entry', () => {
    const state = stateFromSessionEntries([
      {
        customType: 'maestria_state',
        data: { activeTask: 'restore me', mode: 'fein' },
        type: 'custom',
      },
    ]);

    expect(state.activeTask).toBe('restore me');
    expect(state.mode).toBe('fein');
  });

  it('lets the last matching entry win', () => {
    const state = stateFromSessionEntries([
      {
        customType: 'maestria_state',
        data: { activeTask: 'first' },
        type: 'custom',
      },
      { type: 'message' },
      {
        customType: 'maestria_state',
        data: { activeTask: 'second' },
        type: 'custom',
      },
    ]);

    expect(state.activeTask).toBe('second');
  });

  it('ignores non-custom entries, other custom types, and non-record data', () => {
    const state = stateFromSessionEntries([
      { data: { activeTask: 'message entry' }, type: 'message' },
      { customType: 'other', data: { activeTask: 'other custom' }, type: 'custom' },
      { customType: 'maestria_state', data: 'not a record', type: 'custom' },
    ]);

    expect(state.activeTask).toBe('');
  });

  it('keeps initial defaults for fields absent from the persisted data', () => {
    const state = stateFromSessionEntries([
      { customType: 'maestria_state', data: { activeTask: 'only task' }, type: 'custom' },
    ]);

    expect(state.activeTask).toBe('only task');
    expect(state.reviewMode).toBe(false);
    expect(state.filesRead).toEqual([]);
    expect(state.nativeGoal).toBeNull();
  });
});

// ── replaceState ─────────────────────────────────────────────────────

describe('replaceState', () => {
  it('copies the next state values onto the same object', () => {
    const state = createInitialState();
    const next: MaestriaState = { ...createInitialState(), activeTask: 'target task' };

    replaceState(state, next);

    expect(state.activeTask).toBe('target task');
  });

  it('clears stale own keys absent from the next state', () => {
    const state = Object.assign(createInitialState(), { staleMarker: 'old' });
    const next = { ...createInitialState(), activeTask: 'fresh' };

    replaceState(state, next);

    expect(state.activeTask).toBe('fresh');
    expect('staleMarker' in state).toBe(false);
    expect(Object.keys(state).toSorted()).toEqual(Object.keys(next).toSorted());
  });

  it('restores every field of a populated next state', () => {
    const state = { ...createInitialState(), activeTask: 'old task', mode: 'fein' as const };
    const next: MaestriaState = {
      ...createInitialState(),
      activeTask: 'new task',
      blockers: ['blocker'],
      mode: 'sonar',
      reviewMode: true,
    };

    replaceState(state, next);

    expect(state).toEqual(next);
  });
});
