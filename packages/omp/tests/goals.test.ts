import { describe, expect, it, vi } from 'vite-plus/test';

import { installGoalEventHandlers } from '@/goals.js';
import type { GoalApi } from '@/goals.js';
import {
  createInitialState,
  recordFileModified,
  recordHandoff,
  recordSubagentStatus,
} from '@/state.js';
import type { MaestriaState } from '@/state.js';

interface MockPi {
  on: ReturnType<typeof vi.fn<GoalApi['on']>>;
  appendEntry: ReturnType<typeof vi.fn<GoalApi['appendEntry']>>;
}

type EventHandler = Parameters<GoalApi['on']>[1];

const createMockPi = (): MockPi => ({ appendEntry: vi.fn(), on: vi.fn() });

const install = (pi: MockPi, state: MaestriaState) => {
  installGoalEventHandlers(pi, state);
  const { calls } = pi.on.mock;
  const findHandler = (event: string): EventHandler => {
    const call = calls.find(([registeredEvent]) => registeredEvent === event);
    if (call === undefined) {
      throw new Error(`${event} handler was not registered`);
    }
    const [, handler] = call;
    return handler;
  };
  return {
    goalUpdated: findHandler('goal_updated'),
    sessionBranch: findHandler('session_branch'),
    sessionSwitch: findHandler('session_switch'),
    sessionTree: findHandler('session_tree'),
  };
};

const sessionContext = (entries: unknown[] = []) => ({
  sessionManager: {
    getBranch: vi.fn(() => entries),
    getEntries: vi.fn(() => entries),
  },
});

const NATIVE_GOAL = {
  createdAt: 0,
  id: 'g-1',
  objective: 'Implement the goal mirror',
  status: 'active',
  timeUsedSeconds: 5,
  tokensUsed: 10,
  updatedAt: 1,
};

const maestriaOnlyState = (): MaestriaState => {
  let state = createInitialState();
  state = { ...state, activeTask: 'maestria task', mode: 'fein' as const, reviewMode: true };
  state = recordHandoff(state, 'orchestrator', 'builder', 'implement');
  state = recordFileModified(state, 'src/foo.ts');
  state = recordSubagentStatus(state, 'builder', {
    startedAt: 1,
    status: 'running',
    type: 'builder',
  });
  state = { ...state, blockers: ['missing api key'], specialistsDelegated: ['builder'] };
  return state;
};

describe('installGoalEventHandlers', () => {
  it('registers goal and every public session transition handler', () => {
    const pi = createMockPi();
    install(pi, createInitialState());
    const events = pi.on.mock.calls.map((c: unknown[]) => c[0]);
    expect(events).toContain('goal_updated');
    expect(events).toContain('session_switch');
    expect(events).toContain('session_branch');
    expect(events).toContain('session_tree');
  });

  it('mirrors native goal objective/status into state.nativeGoal', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    const { goalUpdated } = install(pi, state);

    await goalUpdated({ goal: NATIVE_GOAL, type: 'goal_updated' }, {});

    expect(state.nativeGoal).toEqual({
      objective: NATIVE_GOAL.objective,
      status: NATIVE_GOAL.status,
    });
  });

  it('clears nativeGoal when event.goal is null', async () => {
    const pi = createMockPi();
    const state = { ...createInitialState(), nativeGoal: { objective: 'old', status: 'active' } };
    const { goalUpdated } = install(pi, state);

    await goalUpdated({ goal: null, type: 'goal_updated' }, {});

    expect(state.nativeGoal).toBeNull();
  });

  it('persists the mirrored state via maestria_state entry', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    const { goalUpdated } = install(pi, state);

    await goalUpdated({ goal: NATIVE_GOAL, type: 'goal_updated' }, {});

    expect(pi.appendEntry).toHaveBeenCalledWith(
      'maestria_state',
      expect.objectContaining({
        nativeGoal: { objective: NATIVE_GOAL.objective, status: NATIVE_GOAL.status },
      }),
    );
  });

  it('mirrors and persists a budget-limited native goal', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    const { goalUpdated } = install(pi, state);

    await goalUpdated(
      { goal: { ...NATIVE_GOAL, status: 'budget-limited' }, type: 'goal_updated' },
      {},
    );

    expect(state.nativeGoal).toEqual({
      objective: NATIVE_GOAL.objective,
      status: 'budget-limited',
    });
    expect(pi.appendEntry).toHaveBeenCalledWith(
      'maestria_state',
      expect.objectContaining({
        nativeGoal: { objective: NATIVE_GOAL.objective, status: 'budget-limited' },
      }),
    );
  });

  it('does not re-persist a duplicate budget-limited native goal', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    const { goalUpdated } = install(pi, state);
    const event = { goal: { ...NATIVE_GOAL, status: 'budget-limited' }, type: 'goal_updated' };

    await goalUpdated(event, {});
    await goalUpdated(event, {});

    expect(pi.appendEntry).toHaveBeenCalledTimes(1);
  });

  it('does not re-persist when the same native goal mirror is re-emitted', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    const { goalUpdated } = install(pi, state);

    await goalUpdated({ goal: NATIVE_GOAL, type: 'goal_updated' }, {});
    await goalUpdated({ goal: NATIVE_GOAL, type: 'goal_updated' }, {});

    expect(pi.appendEntry).toHaveBeenCalledTimes(1);
  });

  it('ignores goal fields outside the objective/status mirror', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    const { goalUpdated } = install(pi, state);

    await goalUpdated({ goal: NATIVE_GOAL, type: 'goal_updated' }, {});
    await goalUpdated(
      { goal: { ...NATIVE_GOAL, tokensUsed: 999, updatedAt: 999 }, type: 'goal_updated' },
      {},
    );

    expect(pi.appendEntry).toHaveBeenCalledTimes(1);
  });

  it('persists when the native goal status changes', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    const { goalUpdated } = install(pi, state);

    await goalUpdated({ goal: NATIVE_GOAL, type: 'goal_updated' }, {});
    await goalUpdated({ goal: { ...NATIVE_GOAL, status: 'paused' }, type: 'goal_updated' }, {});

    expect(pi.appendEntry).toHaveBeenCalledTimes(2);
    const lastCall = pi.appendEntry.mock.calls.at(-1);
    expect(lastCall).toEqual([
      'maestria_state',
      expect.objectContaining({
        nativeGoal: { objective: NATIVE_GOAL.objective, status: 'paused' },
      }),
    ]);
  });

  it('persists the transition to null but skips repeated null mirrors', async () => {
    const pi = createMockPi();
    const state = {
      ...createInitialState(),
      nativeGoal: { objective: 'old goal', status: 'active' },
    };
    const { goalUpdated } = install(pi, state);

    await goalUpdated({ goal: null, type: 'goal_updated' }, {});
    expect(pi.appendEntry).toHaveBeenCalledTimes(1);
    expect(state.nativeGoal).toBeNull();

    await goalUpdated({ goal: null, type: 'goal_updated' }, {});
    expect(pi.appendEntry).toHaveBeenCalledTimes(1);
  });

  it('persists the transition from null to a goal but skips an initial null mirror', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    const { goalUpdated } = install(pi, state);

    await goalUpdated({ goal: null, type: 'goal_updated' }, {});
    expect(pi.appendEntry).not.toHaveBeenCalled();

    await goalUpdated({ goal: NATIVE_GOAL, type: 'goal_updated' }, {});
    expect(pi.appendEntry).toHaveBeenCalledTimes(1);
    expect(state.nativeGoal).toEqual({
      objective: NATIVE_GOAL.objective,
      status: NATIVE_GOAL.status,
    });
  });

  it('does not touch Maestria-only state while mirroring a native goal', async () => {
    const pi = createMockPi();
    const state = maestriaOnlyState();
    const before = structuredClone(state);
    const { goalUpdated } = install(pi, state);

    await goalUpdated({ goal: NATIVE_GOAL, type: 'goal_updated' }, {});

    expect(state.nativeGoal).toEqual({
      objective: NATIVE_GOAL.objective,
      status: NATIVE_GOAL.status,
    });
    expect(state.mode).toBe(before.mode);
    expect(state.activeTask).toBe(before.activeTask);
    expect(state.reviewMode).toBe(before.reviewMode);
    expect(state.handoffHistory).toEqual(before.handoffHistory);
    expect(state.filesModified).toEqual(before.filesModified);
    expect(state.blockers).toEqual(before.blockers);
    expect(state.specialistsDelegated).toEqual(before.specialistsDelegated);
    expect(state.subagentStatus).toEqual(before.subagentStatus);
  });

  it('clears the mirror on session_switch so goals do not leak across sessions', async () => {
    const pi = createMockPi();
    const state = {
      ...createInitialState(),
      nativeGoal: { objective: 'old session goal', status: 'active' },
    };
    const { sessionSwitch } = install(pi, state);

    await sessionSwitch(
      { previousSessionFile: undefined, reason: 'new', type: 'session_switch' },
      sessionContext(),
    );

    expect(state.nativeGoal).toBeNull();
    expect(pi.appendEntry).not.toHaveBeenCalled();
  });

  it('is a no-op on session_switch when no native goal is mirrored', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    const { sessionSwitch } = install(pi, state);

    await sessionSwitch(
      { previousSessionFile: undefined, reason: 'new', type: 'session_switch' },
      sessionContext(),
    );

    expect(state.nativeGoal).toBeNull();
    expect(pi.appendEntry).not.toHaveBeenCalled();
  });

  it('rehydrates the complete target state for new, resume, branch, and handoff transitions', async () => {
    const pi = createMockPi();
    const state = maestriaOnlyState();
    const target = {
      ...createInitialState(),
      activeTask: 'target task',
      blockers: ['target blocker'],
      mode: 'sonar' as const,
      nativeGoal: { objective: 'copied goal', status: 'active' },
    };
    const { sessionSwitch, sessionBranch } = install(pi, state);
    const targetEntries = [{ customType: 'maestria_state', data: target, type: 'custom' }];

    await sessionSwitch(
      { previousSessionFile: undefined, reason: 'new', type: 'session_switch' },
      sessionContext(targetEntries),
    );
    expect(state.mode).toBe('sonar');
    expect(state.activeTask).toBe('target task');
    expect(state.blockers).toEqual(['target blocker']);
    expect(state.nativeGoal).toBeNull();

    state.activeTask = 'source task';
    await sessionSwitch(
      { previousSessionFile: 'old.jsonl', reason: 'resume', type: 'session_switch' },
      sessionContext(targetEntries),
    );
    expect(state.activeTask).toBe('target task');
    expect(state.nativeGoal).toBeNull();

    state.activeTask = 'source task';
    await sessionBranch(
      { previousSessionFile: 'old.jsonl', type: 'session_branch' },
      sessionContext(targetEntries),
    );
    expect(state.activeTask).toBe('target task');
    expect(state.nativeGoal).toBeNull();

    state.activeTask = 'source task';
    await sessionSwitch(
      { previousSessionFile: 'old.jsonl', reason: 'handoff', type: 'session_switch' },
      sessionContext(targetEntries),
    );
    expect(state.activeTask).toBe('target task');
    expect(state.nativeGoal).toBeNull();
    expect(pi.appendEntry).not.toHaveBeenCalled();
  });

  it('resets a forked native mirror when OMP emits no follow-up goal event', async () => {
    const pi = createMockPi();
    const state = {
      ...createInitialState(),
      nativeGoal: { objective: 'parent goal', status: 'active' },
    };
    const { sessionSwitch } = install(pi, state);
    const forkEntries = [
      {
        customType: 'maestria_state',
        data: {
          ...createInitialState(),
          nativeGoal: { objective: 'parent goal', status: 'active' },
        },
        type: 'custom',
      },
    ];

    await sessionSwitch(
      { previousSessionFile: 'parent.jsonl', reason: 'fork', type: 'session_switch' },
      sessionContext(forkEntries),
    );
    expect(state.nativeGoal).toBeNull();
    expect(pi.appendEntry).not.toHaveBeenCalled();
  });

  it('rehydrates native goal state from a public target mode entry without a follow-up event', async () => {
    const pi = createMockPi();
    const state = {
      ...createInitialState(),
      nativeGoal: { objective: 'old goal', status: 'active' },
    };
    const { sessionSwitch } = install(pi, state);
    const targetEntries = [
      {
        data: { goal: { objective: 'target goal', status: 'paused' } },
        mode: 'goal_paused',
        type: 'mode_change',
      },
      {
        customType: 'maestria_state',
        data: {
          ...createInitialState(),
          nativeGoal: { objective: 'copied goal', status: 'active' },
        },
        type: 'custom',
      },
    ];

    await sessionSwitch(
      { previousSessionFile: 'parent.jsonl', reason: 'fork', type: 'session_switch' },
      sessionContext(targetEntries),
    );

    expect(state.nativeGoal).toEqual({
      objective: 'target goal',
      status: 'paused',
    });
    expect(pi.appendEntry).not.toHaveBeenCalled();
  });

  it('rehydrates a budget-limited native goal from a public mode entry', async () => {
    const pi = createMockPi();
    const state = {
      ...createInitialState(),
      nativeGoal: { objective: 'old goal', status: 'active' },
    };
    const { sessionSwitch } = install(pi, state);
    const targetEntries = [
      {
        data: { goal: { objective: 'budget-limited target', status: 'budget-limited' } },
        mode: 'goal',
        type: 'mode_change',
      },
    ];

    await sessionSwitch(
      { previousSessionFile: 'parent.jsonl', reason: 'resume', type: 'session_switch' },
      sessionContext(targetEntries),
    );

    expect(state.nativeGoal).toEqual({
      objective: 'budget-limited target',
      status: 'budget-limited',
    });
    expect(pi.appendEntry).not.toHaveBeenCalled();
  });

  it('clears non-null complete and dropped terminal events and persists the transition', async () => {
    const pi = createMockPi();
    const state = { ...createInitialState(), nativeGoal: { objective: 'old', status: 'active' } };
    const { goalUpdated } = install(pi, state);

    await goalUpdated({ goal: { ...NATIVE_GOAL, status: 'complete' }, type: 'goal_updated' }, {});
    expect(state.nativeGoal).toBeNull();
    expect(pi.appendEntry).toHaveBeenCalledTimes(1);

    await goalUpdated({ goal: { ...NATIVE_GOAL, status: 'dropped' }, type: 'goal_updated' }, {});
    expect(state.nativeGoal).toBeNull();
    expect(pi.appendEntry).toHaveBeenCalledTimes(1);
  });

  it('preserves a paused goal mirror for native lifecycle management', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    const { goalUpdated } = install(pi, state);

    await goalUpdated({ goal: { ...NATIVE_GOAL, status: 'paused' }, type: 'goal_updated' }, {});

    expect(state.nativeGoal).toEqual({ objective: NATIVE_GOAL.objective, status: 'paused' });
  });

  it('rehydrates only the current branch, not a sibling session-state entry', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    const { sessionSwitch } = install(pi, state);
    const siblingState = { ...createInitialState(), activeTask: 'sibling task' };
    const targetState = { ...createInitialState(), activeTask: 'current branch task' };
    const entries = [{ customType: 'maestria_state', data: siblingState, type: 'custom' }];
    const context = sessionContext(entries);
    context.sessionManager.getBranch.mockReturnValue([
      { customType: 'maestria_state', data: targetState, type: 'custom' },
    ]);

    await sessionSwitch(
      { previousSessionFile: 'old.jsonl', reason: 'resume', type: 'session_switch' },
      context,
    );

    expect(state.activeTask).toBe('current branch task');
  });

  it('restores the selected tree leaf and cannot retain sibling mode, task, or native goal', async () => {
    const pi = createMockPi();
    const state = {
      ...maestriaOnlyState(),
      activeTask: 'old active task',
      mode: 'fein' as const,
      nativeGoal: { objective: 'old native goal', status: 'active' },
    };
    const { sessionTree } = install(pi, state);
    const siblingState = {
      ...createInitialState(),
      activeTask: 'sibling task',
      mode: 'sonar' as const,
      nativeGoal: { objective: 'sibling native goal', status: 'active' },
    };
    const targetState = {
      ...createInitialState(),
      activeTask: 'selected task',
      mode: 'blitz' as const,
      nativeGoal: { objective: 'copied native goal', status: 'active' },
    };
    const context = sessionContext([
      { customType: 'maestria_state', data: siblingState, type: 'custom' },
    ]);
    context.sessionManager.getBranch.mockReturnValue([
      { customType: 'maestria_state', data: targetState, type: 'custom' },
      {
        data: { goal: { objective: 'selected native goal', status: 'active' } },
        mode: 'goal',
        type: 'mode_change',
      },
    ]);

    await sessionTree(
      { newLeafId: 'selected-leaf', oldLeafId: 'sibling-leaf', type: 'session_tree' },
      context,
    );

    expect(state.mode).toBe('blitz');
    expect(state.activeTask).toBe('selected task');
    expect(state.nativeGoal).toEqual({ objective: 'selected native goal', status: 'active' });
    expect(pi.appendEntry).not.toHaveBeenCalled();
  });

  it('resets when the public branch is unavailable instead of restoring global sibling entries', async () => {
    const pi = createMockPi();
    const state = {
      ...createInitialState(),
      activeTask: 'previous task',
      mode: 'sonar' as const,
      nativeGoal: { objective: 'previous native goal', status: 'active' },
    };
    const { sessionTree } = install(pi, state);
    const getEntries = vi.fn(() => [
      {
        customType: 'maestria_state',
        data: {
          ...createInitialState(),
          activeTask: 'sibling task',
          mode: 'blitz' as const,
          nativeGoal: { objective: 'sibling native goal', status: 'active' },
        },
        type: 'custom',
      },
    ]);
    const getBranch = vi.fn(() => null);

    await sessionTree(
      { newLeafId: 'target-leaf', oldLeafId: 'sibling-leaf', type: 'session_tree' },
      { sessionManager: { getBranch, getEntries } },
    );

    expect(state.mode).toBeNull();
    expect(state.activeTask).toBe('');
    expect(state.nativeGoal).toBeNull();
    expect(getBranch).toHaveBeenCalledTimes(1);
    expect(getEntries).not.toHaveBeenCalled();
    expect(pi.appendEntry).not.toHaveBeenCalled();
  });
});
