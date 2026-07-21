import { describe, it, expect, vi } from 'vite-plus/test';
import {
  createInitialState,
  cycleToReviewModel,
  persistState,
  recordHandoff,
  recordFileModified,
  recordFileRead,
  setReviewMode,
  exitReviewMode,
  renderMaestriaSummary,
} from '@/state.js';
import type { MaestriaState } from '@/state.js';

const NEW_STATE_KEYS = [
  'mode',
  'activeTask',
  'completionPromise',
  'specialistsDelegated',
  'blockers',
  'filesModified',
  'filesRead',
  'handoffHistory',
  'reviewMode',
  'originalModel',
  'originalTools',
  'subagentStatus',
  'reviewModel',
];

describe('createInitialState', () => {
  it('should return mode: null', () => {
    const state = createInitialState();
    expect(state.mode).toBeNull();
  });

  it('should return a state object with the correct shape', () => {
    const state = createInitialState();
    const keys = Object.keys(state) as Array<keyof MaestriaState>;
    expect(keys.sort()).toEqual([...NEW_STATE_KEYS].sort());
    expect(typeof state.mode === 'string' || state.mode === null).toBe(true);
  });

  it('calling it multiple times returns fresh objects', () => {
    const state1 = createInitialState();
    const state2 = createInitialState();
    expect(state1).not.toBe(state2);
    expect(state1).toEqual(state2);
  });

  it('initializes empty collections and falsy fields correctly', () => {
    const state = createInitialState();
    expect(state.activeTask).toBe('');
    expect(state.completionPromise).toBe('');
    expect(state.specialistsDelegated).toEqual([]);
    expect(state.blockers).toEqual([]);
    expect(state.filesModified).toEqual([]);
    expect(state.filesRead).toEqual([]);
    expect(state.handoffHistory).toEqual([]);
    expect(state.reviewMode).toBe(false);
    expect(state.originalModel).toBeNull();
    expect(state.originalTools).toBeNull();
    expect(state.reviewModel).toBeNull();
  });
});

describe('recordHandoff', () => {
  it('adds an entry with correct fields', () => {
    const state = createInitialState();
    const next = recordHandoff(state, 'adventurer', 'builder', 'implement feature');

    expect(next.handoffHistory).toHaveLength(1);
    const entry = next.handoffHistory[0];
    expect(entry.from).toBe('adventurer');
    expect(entry.to).toBe('builder');
    expect(entry.task).toBe('implement feature');
    expect(typeof entry.timestamp).toBe('number');
  });

  it('is immutable - does not mutate the original state', () => {
    const state = createInitialState();
    recordHandoff(state, 'a', 'b', 'c');
    expect(state.handoffHistory).toHaveLength(0);
  });

  it('prepends entries (most recent first)', () => {
    const state = createInitialState();
    const s1 = recordHandoff(state, 'a', 'b', 'first');
    const s2 = recordHandoff(s1, 'c', 'd', 'second');

    expect(s2.handoffHistory).toHaveLength(2);
    expect(s2.handoffHistory[0].task).toBe('second');
    expect(s2.handoffHistory[1].task).toBe('first');
  });

  it('caps at 5 entries, dropping oldest on overflow', () => {
    let state = createInitialState();
    for (let i = 1; i <= 6; i++) {
      state = recordHandoff(state, `from${i}`, `to${i}`, `task${i}`);
    }

    expect(state.handoffHistory).toHaveLength(5);
    // Most recent (6) should be first
    expect(state.handoffHistory[0].task).toBe('task6');
    // Oldest (1) should be dropped
    expect(state.handoffHistory[4].task).toBe('task2');
    expect(state.handoffHistory.some((e) => e.task === 'task1')).toBe(false);
  });
});

describe('recordFileModified', () => {
  it('adds a file to an empty list', () => {
    const state = createInitialState();
    const next = recordFileModified(state, 'src/foo.ts');

    expect(next.filesModified).toEqual(['src/foo.ts']);
  });

  it('prepends the new path', () => {
    let state = createInitialState();
    state = recordFileModified(state, 'src/a.ts');
    state = recordFileModified(state, 'src/b.ts');

    expect(state.filesModified[0]).toBe('src/b.ts');
    expect(state.filesModified).toEqual(['src/b.ts', 'src/a.ts']);
  });

  it('deduplicates and reorders to most recent', () => {
    let state = createInitialState();
    state = recordFileModified(state, 'src/a.ts');
    state = recordFileModified(state, 'src/b.ts');
    state = recordFileModified(state, 'src/a.ts');

    expect(state.filesModified).toHaveLength(2);
    expect(state.filesModified[0]).toBe('src/a.ts');
    expect(state.filesModified[1]).toBe('src/b.ts');
  });

  it('caps at 10 entries', () => {
    let state = createInitialState();
    for (let i = 1; i <= 11; i++) {
      state = recordFileModified(state, `file${i}.ts`);
    }

    expect(state.filesModified).toHaveLength(10);
    expect(state.filesModified[0]).toBe('file11.ts');
    expect(state.filesModified[9]).toBe('file2.ts');
    expect(state.filesModified.includes('file1.ts')).toBe(false);
  });
});

describe('recordFileRead', () => {
  it('adds a file to an empty list', () => {
    const state = createInitialState();
    const next = recordFileRead(state, 'src/foo.ts');

    expect(next.filesRead).toEqual(['src/foo.ts']);
  });

  it('prepends and deduplicates', () => {
    let state = createInitialState();
    state = recordFileRead(state, 'src/a.ts');
    state = recordFileRead(state, 'src/b.ts');
    state = recordFileRead(state, 'src/a.ts');

    expect(state.filesRead).toHaveLength(2);
    expect(state.filesRead[0]).toBe('src/a.ts');
    expect(state.filesRead[1]).toBe('src/b.ts');
  });

  it('caps at 10 entries', () => {
    let state = createInitialState();
    for (let i = 1; i <= 11; i++) {
      state = recordFileRead(state, `file${i}.ts`);
    }

    expect(state.filesRead).toHaveLength(10);
    expect(state.filesRead.includes('file1.ts')).toBe(false);
  });
});

describe('setReviewMode', () => {
  it('sets reviewMode to true', () => {
    const state = createInitialState();
    const next = setReviewMode(state, true);

    expect(next.reviewMode).toBe(true);
  });

  it('clears reviewMode when active is false', () => {
    const state = createInitialState();
    const enabled = setReviewMode(state, true);
    const next = setReviewMode(enabled, false);

    expect(next.reviewMode).toBe(false);
  });

  it('is immutable - does not mutate the original state', () => {
    const state = createInitialState();
    setReviewMode(state, true);
    expect(state.reviewMode).toBe(false);
  });
});

describe('renderMaestriaSummary', () => {
  it('produces all 6 sections when all fields are populated', () => {
    let state = createInitialState();
    state = { ...state, activeTask: 'build the feature' };
    state = { ...state, completionPromise: 'tests pass' };
    state = { ...state, specialistsDelegated: ['builder', 'reviewer'] };
    state = { ...state, blockers: ['missing API key', 'unclear spec'] };
    state = recordFileModified(state, 'src/foo.ts');
    state = recordFileRead(state, 'src/bar.ts');
    state = recordHandoff(state, 'adventurer', 'builder', 'implement');

    const summary = renderMaestriaSummary(state);

    expect(summary).toContain('**Goal:** build the feature');
    expect(summary).toContain('**Completion Promise:** tests pass');
    expect(summary).toContain('**Specialists Delegated:** builder, reviewer');
    expect(summary).toContain('**Blockers:**');
    expect(summary).toContain('- missing API key');
    expect(summary).toContain('- unclear spec');
    expect(summary).toContain('**Files:**');
    expect(summary).toContain('**Modified:** src/foo.ts');
    expect(summary).toContain('**Read:** src/bar.ts');
    expect(summary).toContain('**Recent Handoffs:**');
    expect(summary).toContain('- adventurer → builder: implement');
  });

  it('omits empty sections', () => {
    const state = createInitialState();
    const summary = renderMaestriaSummary(state);

    expect(summary).not.toContain('**Goal:**');
    expect(summary).not.toContain('**Completion Promise:**');
    expect(summary).not.toContain('**Specialists Delegated:**');
    expect(summary).not.toContain('**Blockers:**');
    expect(summary).not.toContain('**Files:**');
    expect(summary).not.toContain('**Recent Handoffs:**');
    expect(summary).toBe('');
  });

  it('omits files section when both modified and read are empty', () => {
    const state = {
      ...createInitialState(),
      activeTask: 'just a goal',
    };
    const summary = renderMaestriaSummary(state);

    expect(summary).toContain('**Goal:** just a goal');
    expect(summary).not.toContain('**Files:**');
  });

  it('includes modified-only files section', () => {
    let state = createInitialState();
    state = recordFileModified(state, 'src/only.ts');
    const summary = renderMaestriaSummary(state);

    expect(summary).toContain('**Files:**');
    expect(summary).toContain('**Modified:** src/only.ts');
    expect(summary).not.toContain('**Read:**');
  });

  it('includes read-only files section', () => {
    let state = createInitialState();
    state = recordFileRead(state, 'src/readonly.ts');
    const summary = renderMaestriaSummary(state);

    expect(summary).toContain('**Files:**');
    expect(summary).toContain('**Read:** src/readonly.ts');
    expect(summary).not.toContain('**Modified:**');
  });
});

describe('state persistence pattern', () => {
  it('calls appendEntry with current state after mutation', () => {
    const pi = { appendEntry: vi.fn() };
    const state = createInitialState();

    // Simulate the mutation + persistence pattern used in commands/subagent
    const updatedState = recordHandoff(state, 'orchestrator', 'builder', 'implement feature');
    Object.assign(state, updatedState);
    pi.appendEntry('maestria_state', state);

    expect(pi.appendEntry).toHaveBeenCalledWith(
      'maestria_state',
      expect.objectContaining({
        handoffHistory: expect.arrayContaining([
          expect.objectContaining({
            from: 'orchestrator',
            to: 'builder',
            task: 'implement feature',
          }),
        ]),
      }),
    );
  });
});

describe('exitReviewMode', () => {
  it('clears reviewMode, originalModel, originalTools', () => {
    const state: MaestriaState = {
      ...createInitialState(),
      reviewMode: true,
      originalModel: 'gpt-4o',
      originalTools: ['read', 'grep', 'bash'],
    };

    const { state: next, originalModel, originalTools } = exitReviewMode(state);

    expect(next.reviewMode).toBe(false);
    expect(next.originalModel).toBeNull();
    expect(next.originalTools).toBeNull();
    expect(originalModel).toBe('gpt-4o');
    expect(originalTools).toEqual(['read', 'grep', 'bash']);
  });

  it('is immutable - does not mutate the original state', () => {
    const state: MaestriaState = {
      ...createInitialState(),
      reviewMode: true,
      originalModel: 'claude-sonnet',
      originalTools: ['read', 'grep'],
    };

    exitReviewMode(state);

    expect(state.reviewMode).toBe(true);
    expect(state.originalModel).toBe('claude-sonnet');
    expect(state.originalTools).toEqual(['read', 'grep']);
  });

  it('handles null originals gracefully', () => {
    const state: MaestriaState = {
      ...createInitialState(),
      reviewMode: true,
    };

    const { state: next, originalModel, originalTools } = exitReviewMode(state);

    expect(next.reviewMode).toBe(false);
    expect(originalModel).toBeNull();
    expect(originalTools).toBeNull();
  });
});

describe('cycleToReviewModel', () => {
  it('switches to configured reviewModel when found in registry', async () => {
    const pi = { setModel: vi.fn().mockResolvedValue(true), appendEntry: vi.fn() };
    const ctx = {
      modelRegistry: { getAll: vi.fn().mockReturnValue([{ id: 'gpt-4o' }]) },
      model: { id: 'claude-sonnet-4-20250514' },
      ui: { notify: vi.fn() },
    };
    const state: MaestriaState = {
      ...createInitialState(),
      reviewModel: 'gpt-4o',
    };

    const result = await cycleToReviewModel(pi as any, ctx as any, state);

    expect(result).toBe('gpt-4o');
    expect(pi.setModel).toHaveBeenCalledWith({ id: 'gpt-4o' });
  });

  it('returns null and notifies when configured model is not found', async () => {
    const pi = { setModel: vi.fn(), appendEntry: vi.fn() };
    const ctx = {
      modelRegistry: { getAll: vi.fn().mockReturnValue([{ id: 'claude-sonnet-4-20250514' }]) },
      model: { id: 'claude-sonnet-4-20250514' },
      ui: { notify: vi.fn() },
    };
    const state: MaestriaState = {
      ...createInitialState(),
      reviewModel: 'nonexistent-model',
    };

    const result = await cycleToReviewModel(pi as any, ctx as any, state);

    expect(result).toBeNull();
    expect(pi.setModel).not.toHaveBeenCalled();
    expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('nonexistent-model'));
  });

  it('returns null when reviewModel is not set', async () => {
    const pi = { setModel: vi.fn().mockResolvedValue(true), appendEntry: vi.fn() };
    const ctx = {
      modelRegistry: {
        getAll: vi.fn().mockReturnValue([{ id: 'claude-sonnet-4-20250514' }, { id: 'gpt-4o' }]),
      },
      model: { id: 'claude-sonnet-4-20250514' },
      ui: { notify: vi.fn() },
    };
    const state: MaestriaState = {
      ...createInitialState(),
      reviewModel: null,
    };

    const result = await cycleToReviewModel(pi as any, ctx as any, state);

    expect(result).toBeNull();
    expect(pi.setModel).not.toHaveBeenCalled();
  });

  it('returns null when setModel throws', async () => {
    const pi = { setModel: vi.fn().mockRejectedValue(new Error('no key')), appendEntry: vi.fn() };
    const ctx = {
      modelRegistry: { getAll: vi.fn().mockReturnValue([{ id: 'gpt-4o' }]) },
      model: { id: 'claude-sonnet-4-20250514' },
      ui: { notify: vi.fn() },
    };
    const state: MaestriaState = {
      ...createInitialState(),
      reviewModel: 'gpt-4o',
    };

    const result = await cycleToReviewModel(pi as any, ctx as any, state);

    expect(result).toBeNull();
    expect(pi.setModel).toHaveBeenCalled();
    expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('gpt-4o'));
  });
});

describe('persistState', () => {
  it('calls pi.appendEntry with maestria_state and a copy of state', () => {
    const pi = { appendEntry: vi.fn() };
    const state = createInitialState();

    persistState(pi as any, state);

    expect(pi.appendEntry).toHaveBeenCalledWith('maestria_state', { ...state });
    // Ensure it's a copy, not the original reference
    expect(pi.appendEntry.mock.calls[0][1]).not.toBe(state);
  });
});

describe('renderMaestriaSummary with reviewModel', () => {
  it('includes review model section when set', () => {
    const state: MaestriaState = {
      ...createInitialState(),
      reviewModel: 'gpt-4o',
    };

    const summary = renderMaestriaSummary(state);

    expect(summary).toContain('**Review Model:** gpt-4o');
  });

  it('omits review model section when not set', () => {
    const state = createInitialState();

    const summary = renderMaestriaSummary(state);

    expect(summary).not.toContain('**Review Model:**');
  });
});
