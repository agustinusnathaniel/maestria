import { describe, expect, it, vi } from 'vite-plus/test';

import {
  createInitialState,
  exitReviewMode,
  FILE_HISTORY_CAP,
  HANDOFF_HISTORY_CAP,
  persistState,
  readSessionBranch,
  recordFileModified,
  recordFileRead,
  recordHandoff,
  recordSpecialistDelegated,
  renderMaestriaSummary,
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

// ── Transforms ───────────────────────────────────────────────────────

const STATE_KEYS = [
  'activeTask',
  'blockers',
  'completionPromise',
  'filesModified',
  'filesRead',
  'handoffHistory',
  'mode',
  'nativeGoal',
  'originalModel',
  'originalTools',
  'reviewMode',
  'reviewModel',
  'specialistsDelegated',
  'subagentStatus',
];

describe('createInitialState', () => {
  it('returns the full state shape with nulls and empty collections', () => {
    const state = createInitialState();

    expect(Object.keys(state).toSorted()).toEqual(STATE_KEYS.toSorted());
    expect(state.mode).toBeNull();
    expect(state.nativeGoal).toBeNull();
    expect(state.originalModel).toBeNull();
    expect(state.originalTools).toBeNull();
    expect(state.reviewModel).toBeNull();
    expect(state.reviewMode).toBe(false);
    expect(state.activeTask).toBe('');
    expect(state.completionPromise).toBe('');
    expect(state.specialistsDelegated).toEqual([]);
    expect(state.blockers).toEqual([]);
    expect(state.filesModified).toEqual([]);
    expect(state.filesRead).toEqual([]);
    expect(state.handoffHistory).toEqual([]);
    expect(state.subagentStatus).toEqual({});
  });

  it('returns a fresh object on every call', () => {
    const first = createInitialState();
    const second = createInitialState();

    expect(first).not.toBe(second);
    expect(first).toEqual(second);
  });
});

describe('recordHandoff', () => {
  it('adds an entry with the handoff fields and a timestamp', () => {
    const next = recordHandoff(createInitialState(), 'adventurer', 'builder', 'implement feature');

    expect(next.handoffHistory).toHaveLength(1);
    const [entry] = next.handoffHistory;
    if (entry === undefined) {
      throw new Error('Handoff entry was not recorded');
    }
    expect(entry.from).toBe('adventurer');
    expect(entry.to).toBe('builder');
    expect(entry.task).toBe('implement feature');
    expect(typeof entry.timestamp).toBe('number');
  });

  it('prepends entries, most recent first', () => {
    const first = recordHandoff(createInitialState(), 'a', 'b', 'first');
    const second = recordHandoff(first, 'c', 'd', 'second');

    expect(second.handoffHistory[0]?.task).toBe('second');
    expect(second.handoffHistory[1]?.task).toBe('first');
  });

  it('caps the history at HANDOFF_HISTORY_CAP, dropping the oldest', () => {
    let state = createInitialState();
    for (let i = 1; i <= HANDOFF_HISTORY_CAP + 1; i += 1) {
      state = recordHandoff(state, `from${i}`, `to${i}`, `task${i}`);
    }

    expect(state.handoffHistory).toHaveLength(HANDOFF_HISTORY_CAP);
    expect(state.handoffHistory[0]?.task).toBe(`task${HANDOFF_HISTORY_CAP + 1}`);
    expect(state.handoffHistory.at(-1)?.task).toBe('task2');
    expect(state.handoffHistory.some((entry) => entry.task === 'task1')).toBe(false);
  });

  it('does not mutate the original state', () => {
    const state = createInitialState();
    recordHandoff(state, 'a', 'b', 'c');

    expect(state.handoffHistory).toHaveLength(0);
  });
});

describe('recordSpecialistDelegated', () => {
  it('appends specialists in delegation order and deduplicates repeats', () => {
    let state = createInitialState();
    state = recordSpecialistDelegated(state, 'builder');
    state = recordSpecialistDelegated(state, 'architect');
    state = recordSpecialistDelegated(state, 'builder');

    expect(state.specialistsDelegated).toEqual(['builder', 'architect']);
  });

  it('adds to an empty list without mutating the original state', () => {
    const state = createInitialState();
    const next = recordSpecialistDelegated(state, 'builder');

    expect(next.specialistsDelegated).toEqual(['builder']);
    expect(state.specialistsDelegated).toEqual([]);
  });
});

describe('recordFileModified', () => {
  it('records a new path, prepends, and deduplicates to most recent', () => {
    let state = createInitialState();
    expect(recordFileModified(state, 'src/a.ts').filesModified).toEqual(['src/a.ts']);

    state = recordFileModified(state, 'src/a.ts');
    state = recordFileModified(state, 'src/b.ts');
    expect(state.filesModified).toEqual(['src/b.ts', 'src/a.ts']);

    state = recordFileModified(state, 'src/a.ts');
    expect(state.filesModified).toEqual(['src/a.ts', 'src/b.ts']);
  });

  it('caps the history at FILE_HISTORY_CAP', () => {
    let state = createInitialState();
    for (let i = 1; i <= FILE_HISTORY_CAP + 1; i += 1) {
      state = recordFileModified(state, `file${i}.ts`);
    }

    expect(state.filesModified).toHaveLength(FILE_HISTORY_CAP);
    expect(state.filesModified[0]).toBe(`file${FILE_HISTORY_CAP + 1}.ts`);
    expect(state.filesModified.at(-1)).toBe('file2.ts');
    expect(state.filesModified).not.toContain('file1.ts');
  });
});

describe('recordFileRead', () => {
  it('records a new path, prepends, and deduplicates to most recent', () => {
    let state = createInitialState();
    expect(recordFileRead(state, 'src/a.ts').filesRead).toEqual(['src/a.ts']);

    state = recordFileRead(state, 'src/a.ts');
    state = recordFileRead(state, 'src/b.ts');
    expect(state.filesRead).toEqual(['src/b.ts', 'src/a.ts']);

    state = recordFileRead(state, 'src/a.ts');
    expect(state.filesRead).toEqual(['src/a.ts', 'src/b.ts']);
  });

  it('caps the history at FILE_HISTORY_CAP', () => {
    let state = createInitialState();
    for (let i = 1; i <= FILE_HISTORY_CAP + 1; i += 1) {
      state = recordFileRead(state, `file${i}.ts`);
    }

    expect(state.filesRead).toHaveLength(FILE_HISTORY_CAP);
    expect(state.filesRead).not.toContain('file1.ts');
  });
});

describe('exitReviewMode', () => {
  it('returns the saved originals and clears the review fields', () => {
    const state: MaestriaState = {
      ...createInitialState(),
      originalModel: 'gpt-4o',
      originalTools: ['read', 'grep', 'bash'],
      reviewMode: true,
    };

    const { state: next, originalModel, originalTools } = exitReviewMode(state);

    expect(next.reviewMode).toBe(false);
    expect(next.originalModel).toBeNull();
    expect(next.originalTools).toBeNull();
    expect(originalModel).toBe('gpt-4o');
    expect(originalTools).toEqual(['read', 'grep', 'bash']);
  });

  it('does not mutate the original state', () => {
    const state: MaestriaState = {
      ...createInitialState(),
      originalModel: 'claude-sonnet',
      originalTools: ['read', 'grep'],
      reviewMode: true,
    };

    exitReviewMode(state);

    expect(state.reviewMode).toBe(true);
    expect(state.originalModel).toBe('claude-sonnet');
    expect(state.originalTools).toEqual(['read', 'grep']);
  });

  it('handles null originals gracefully', () => {
    const {
      state: next,
      originalModel,
      originalTools,
    } = exitReviewMode({
      ...createInitialState(),
      reviewMode: true,
    });

    expect(next.reviewMode).toBe(false);
    expect(originalModel).toBeNull();
    expect(originalTools).toBeNull();
  });
});

describe('persistState', () => {
  it('appends a copy of the state under the maestria_state entry', () => {
    const appendEntry = vi.fn<(type: string, data: unknown) => void>();
    const state = createInitialState();

    persistState({ appendEntry }, state);

    expect(appendEntry).toHaveBeenCalledWith('maestria_state', { ...state });
    const [, persisted] = appendEntry.mock.calls[0] ?? [];
    expect(persisted).not.toBe(state);
  });
});

describe('renderMaestriaSummary', () => {
  it('renders every populated section', () => {
    let state = createInitialState();
    state = { ...state, activeTask: 'build the feature' };
    state = { ...state, completionPromise: 'tests pass' };
    state = { ...state, specialistsDelegated: ['/builder', '/reviewer'] };
    state = { ...state, blockers: ['missing API key', 'unclear spec'] };
    state = recordFileModified(state, 'src/foo.ts');
    state = recordFileRead(state, 'src/bar.ts');
    state = recordHandoff(state, 'adventurer', 'builder', 'implement');

    const summary = renderMaestriaSummary(state);

    expect(summary).toContain('**Goal:** build the feature');
    expect(summary).toContain('**Completion Promise:** tests pass');
    expect(summary).toContain('**Specialists Delegated:** /builder, /reviewer');
    expect(summary).toContain('**Blockers:**');
    expect(summary).toContain('- missing API key');
    expect(summary).toContain('- unclear spec');
    expect(summary).toContain('**Files:**');
    expect(summary).toContain('**Modified:** src/foo.ts');
    expect(summary).toContain('**Read:** src/bar.ts');
    expect(summary).toContain('**Recent Handoffs:**');
    expect(summary).toContain('- adventurer → builder: implement');
  });

  it('omits empty sections and returns an empty string', () => {
    const summary = renderMaestriaSummary(createInitialState());

    expect(summary).not.toContain('**Goal:**');
    expect(summary).not.toContain('**Completion Promise:**');
    expect(summary).not.toContain('**Specialists Delegated:**');
    expect(summary).not.toContain('**Blockers:**');
    expect(summary).not.toContain('**Files:**');
    expect(summary).not.toContain('**Recent Handoffs:**');
    expect(summary).toBe('');
  });

  it('renders files only for the populated side', () => {
    const modified = renderMaestriaSummary(recordFileModified(createInitialState(), 'src/only.ts'));
    expect(modified).toContain('**Files:**');
    expect(modified).toContain('**Modified:** src/only.ts');
    expect(modified).not.toContain('**Read:**');

    const read = renderMaestriaSummary(recordFileRead(createInitialState(), 'src/readonly.ts'));
    expect(read).toContain('**Files:**');
    expect(read).toContain('**Read:** src/readonly.ts');
    expect(read).not.toContain('**Modified:**');

    const goalOnly = renderMaestriaSummary({
      ...createInitialState(),
      activeTask: 'just a goal',
    });
    expect(goalOnly).toContain('**Goal:** just a goal');
    expect(goalOnly).not.toContain('**Files:**');
  });

  it('renders the review model only when configured', () => {
    const withModel = renderMaestriaSummary({ ...createInitialState(), reviewModel: 'gpt-4o' });

    expect(withModel).toContain('**Review Model:** gpt-4o');
    expect(renderMaestriaSummary(createInitialState())).not.toContain('**Review Model:**');
  });
});
