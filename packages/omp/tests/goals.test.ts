import { describe, it, expect, vi } from 'vite-plus/test';
import { installGoalEventHandlers } from '@/goals.js';
import { createModeController } from '@maestria/shared-pi/modes-core';
import {
  createInitialState,
  recordHandoff,
  recordFileModified,
  recordSubagentStatus,
} from '@/state.js';
import type { MaestriaState } from '@/state.js';

interface MockPi {
  on: ReturnType<typeof vi.fn>;
  appendEntry: ReturnType<typeof vi.fn>;
}

function createMockPi(): MockPi {
  return { on: vi.fn(), appendEntry: vi.fn() };
}

function install(pi: MockPi, state: MaestriaState, modeController = createModeController(state)) {
  installGoalEventHandlers(pi as any, state, modeController);
  const calls = (pi.on as ReturnType<typeof vi.fn>).mock.calls as Array<
    [string, (...args: unknown[]) => unknown]
  >;
  const goalUpdatedCall = calls.find(([event]) => event === 'goal_updated');
  const sessionSwitchCall = calls.find(([event]) => event === 'session_switch');
  const sessionBranchCall = calls.find(([event]) => event === 'session_branch');
  const sessionTreeCall = calls.find(([event]) => event === 'session_tree');
  expect(goalUpdatedCall).toBeDefined();
  expect(sessionSwitchCall).toBeDefined();
  expect(sessionBranchCall).toBeDefined();
  expect(sessionTreeCall).toBeDefined();
  return {
    goalUpdated: goalUpdatedCall![1],
    sessionSwitch: sessionSwitchCall![1],
    sessionBranch: sessionBranchCall![1],
    sessionTree: sessionTreeCall![1],
    modeController,
  };
}

function sessionContext(entries: unknown[] = []) {
  return {
    sessionManager: {
      getBranch: vi.fn(() => entries),
      getEntries: vi.fn(() => entries),
    },
  };
}

const NATIVE_GOAL = {
  id: 'g-1',
  objective: 'Implement the goal mirror',
  status: 'active',
  tokensUsed: 10,
  timeUsedSeconds: 5,
  createdAt: 0,
  updatedAt: 1,
};

function maestriaOnlyState(): MaestriaState {
  let state = createInitialState();
  state = { ...state, mode: 'fein' as const, activeTask: 'maestria task', reviewMode: true };
  state = recordHandoff(state, 'orchestrator', 'builder', 'implement');
  state = recordFileModified(state, 'src/foo.ts');
  state = recordSubagentStatus(state, 'builder', {
    type: 'builder',
    status: 'running',
    startedAt: 1,
  });
  state = { ...state, blockers: ['missing api key'], specialistsDelegated: ['builder'] };
  return state;
}

describe('installGoalEventHandlers', () => {
  it('registers goal and every public session transition handler', () => {
    const pi = createMockPi();
    install(pi, createInitialState());
    const events = (pi.on as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0]);
    expect(events).toContain('goal_updated');
    expect(events).toContain('session_switch');
    expect(events).toContain('session_branch');
    expect(events).toContain('session_tree');
  });

  it('clears transient automatic mode at every public session transition', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    const { sessionSwitch, sessionBranch, sessionTree, modeController } = install(pi, state);

    for (const transition of [sessionSwitch, sessionBranch, sessionTree]) {
      modeController.setAutomaticMode('blitz');
      await transition({}, sessionContext());
      expect(modeController.getMode()).toBeNull();
    }
  });

  it('mirrors native goal objective/status into state.nativeGoal', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    const { goalUpdated } = install(pi, state);

    await goalUpdated({ type: 'goal_updated', goal: NATIVE_GOAL }, {});

    expect(state.nativeGoal).toEqual({
      objective: NATIVE_GOAL.objective,
      status: NATIVE_GOAL.status,
    });
  });

  it('clears nativeGoal when event.goal is null', async () => {
    const pi = createMockPi();
    const state = { ...createInitialState(), nativeGoal: { objective: 'old', status: 'active' } };
    const { goalUpdated } = install(pi, state);

    await goalUpdated({ type: 'goal_updated', goal: null }, {});

    expect(state.nativeGoal).toBeNull();
  });

  it('persists the mirrored state via maestria_state entry', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    const { goalUpdated } = install(pi, state);

    await goalUpdated({ type: 'goal_updated', goal: NATIVE_GOAL }, {});

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
      { type: 'goal_updated', goal: { ...NATIVE_GOAL, status: 'budget-limited' } },
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
    const event = { type: 'goal_updated', goal: { ...NATIVE_GOAL, status: 'budget-limited' } };

    await goalUpdated(event, {});
    await goalUpdated(event, {});

    expect(pi.appendEntry).toHaveBeenCalledTimes(1);
  });

  it('does not re-persist when the same native goal mirror is re-emitted', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    const { goalUpdated } = install(pi, state);

    await goalUpdated({ type: 'goal_updated', goal: NATIVE_GOAL }, {});
    await goalUpdated({ type: 'goal_updated', goal: NATIVE_GOAL }, {});

    expect(pi.appendEntry).toHaveBeenCalledTimes(1);
  });

  it('ignores goal fields outside the objective/status mirror', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    const { goalUpdated } = install(pi, state);

    await goalUpdated({ type: 'goal_updated', goal: NATIVE_GOAL }, {});
    await goalUpdated(
      { type: 'goal_updated', goal: { ...NATIVE_GOAL, tokensUsed: 999, updatedAt: 999 } },
      {},
    );

    expect(pi.appendEntry).toHaveBeenCalledTimes(1);
  });

  it('persists when the native goal status changes', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    const { goalUpdated } = install(pi, state);

    await goalUpdated({ type: 'goal_updated', goal: NATIVE_GOAL }, {});
    await goalUpdated({ type: 'goal_updated', goal: { ...NATIVE_GOAL, status: 'paused' } }, {});

    expect(pi.appendEntry).toHaveBeenCalledTimes(2);
    const lastCall = (pi.appendEntry as ReturnType<typeof vi.fn>).mock.calls.at(-1);
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

    await goalUpdated({ type: 'goal_updated', goal: null }, {});
    expect(pi.appendEntry).toHaveBeenCalledTimes(1);
    expect(state.nativeGoal).toBeNull();

    await goalUpdated({ type: 'goal_updated', goal: null }, {});
    expect(pi.appendEntry).toHaveBeenCalledTimes(1);
  });

  it('persists the transition from null to a goal but skips an initial null mirror', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    const { goalUpdated } = install(pi, state);

    await goalUpdated({ type: 'goal_updated', goal: null }, {});
    expect(pi.appendEntry).not.toHaveBeenCalled();

    await goalUpdated({ type: 'goal_updated', goal: NATIVE_GOAL }, {});
    expect(pi.appendEntry).toHaveBeenCalledTimes(1);
    expect(state.nativeGoal).toEqual({
      objective: NATIVE_GOAL.objective,
      status: NATIVE_GOAL.status,
    });
  });

  it('does not touch Maestria-only state while mirroring a native goal', async () => {
    const pi = createMockPi();
    const state = maestriaOnlyState();
    const before = JSON.parse(JSON.stringify(state));
    const { goalUpdated } = install(pi, state);

    await goalUpdated({ type: 'goal_updated', goal: NATIVE_GOAL }, {});

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
      { type: 'session_switch', reason: 'new', previousSessionFile: undefined },
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
      { type: 'session_switch', reason: 'new', previousSessionFile: undefined },
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
      mode: 'sonar' as const,
      activeTask: 'target task',
      blockers: ['target blocker'],
      nativeGoal: { objective: 'copied goal', status: 'active' },
    };
    const { sessionSwitch, sessionBranch } = install(pi, state);
    const targetEntries = [{ type: 'custom', customType: 'maestria_state', data: target }];

    await sessionSwitch(
      { type: 'session_switch', reason: 'new', previousSessionFile: undefined },
      sessionContext(targetEntries),
    );
    expect(state.mode).toBe('sonar');
    expect(state.activeTask).toBe('target task');
    expect(state.blockers).toEqual(['target blocker']);
    expect(state.nativeGoal).toBeNull();

    state.activeTask = 'source task';
    await sessionSwitch(
      { type: 'session_switch', reason: 'resume', previousSessionFile: 'old.jsonl' },
      sessionContext(targetEntries),
    );
    expect(state.activeTask).toBe('target task');
    expect(state.nativeGoal).toBeNull();

    state.activeTask = 'source task';
    await sessionBranch(
      { type: 'session_branch', previousSessionFile: 'old.jsonl' },
      sessionContext(targetEntries),
    );
    expect(state.activeTask).toBe('target task');
    expect(state.nativeGoal).toBeNull();

    state.activeTask = 'source task';
    await sessionSwitch(
      { type: 'session_switch', reason: 'handoff', previousSessionFile: 'old.jsonl' },
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
        type: 'custom',
        customType: 'maestria_state',
        data: {
          ...createInitialState(),
          nativeGoal: { objective: 'parent goal', status: 'active' },
        },
      },
    ];

    await sessionSwitch(
      { type: 'session_switch', reason: 'fork', previousSessionFile: 'parent.jsonl' },
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
        type: 'mode_change',
        mode: 'goal_paused',
        data: { goal: { objective: 'target goal', status: 'paused' } },
      },
      {
        type: 'custom',
        customType: 'maestria_state',
        data: {
          ...createInitialState(),
          nativeGoal: { objective: 'copied goal', status: 'active' },
        },
      },
    ];

    await sessionSwitch(
      { type: 'session_switch', reason: 'fork', previousSessionFile: 'parent.jsonl' },
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
        type: 'mode_change',
        mode: 'goal',
        data: { goal: { objective: 'budget-limited target', status: 'budget-limited' } },
      },
    ];

    await sessionSwitch(
      { type: 'session_switch', reason: 'resume', previousSessionFile: 'parent.jsonl' },
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

    await goalUpdated({ type: 'goal_updated', goal: { ...NATIVE_GOAL, status: 'complete' } }, {});
    expect(state.nativeGoal).toBeNull();
    expect(pi.appendEntry).toHaveBeenCalledTimes(1);

    await goalUpdated({ type: 'goal_updated', goal: { ...NATIVE_GOAL, status: 'dropped' } }, {});
    expect(state.nativeGoal).toBeNull();
    expect(pi.appendEntry).toHaveBeenCalledTimes(1);
  });

  it('preserves a paused goal mirror for native lifecycle management', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    const { goalUpdated } = install(pi, state);

    await goalUpdated({ type: 'goal_updated', goal: { ...NATIVE_GOAL, status: 'paused' } }, {});

    expect(state.nativeGoal).toEqual({ objective: NATIVE_GOAL.objective, status: 'paused' });
  });

  it('rehydrates only the current branch, not a sibling session-state entry', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    const { sessionSwitch } = install(pi, state);
    const siblingState = { ...createInitialState(), activeTask: 'sibling task' };
    const targetState = { ...createInitialState(), activeTask: 'current branch task' };
    const entries = [{ type: 'custom', customType: 'maestria_state', data: siblingState }];
    const context = sessionContext(entries);
    context.sessionManager.getBranch.mockReturnValue([
      { type: 'custom', customType: 'maestria_state', data: targetState },
    ]);

    await sessionSwitch(
      { type: 'session_switch', reason: 'resume', previousSessionFile: 'old.jsonl' },
      context,
    );

    expect(state.activeTask).toBe('current branch task');
  });

  it('restores the selected tree leaf and cannot retain sibling mode, task, or native goal', async () => {
    const pi = createMockPi();
    const state = {
      ...maestriaOnlyState(),
      mode: 'fein' as const,
      activeTask: 'old active task',
      nativeGoal: { objective: 'old native goal', status: 'active' },
    };
    const { sessionTree } = install(pi, state);
    const siblingState = {
      ...createInitialState(),
      mode: 'sonar' as const,
      activeTask: 'sibling task',
      nativeGoal: { objective: 'sibling native goal', status: 'active' },
    };
    const targetState = {
      ...createInitialState(),
      mode: 'blitz' as const,
      activeTask: 'selected task',
      nativeGoal: { objective: 'copied native goal', status: 'active' },
    };
    const context = sessionContext([
      { type: 'custom', customType: 'maestria_state', data: siblingState },
    ]);
    context.sessionManager.getBranch.mockReturnValue([
      { type: 'custom', customType: 'maestria_state', data: targetState },
      {
        type: 'mode_change',
        mode: 'goal',
        data: { goal: { objective: 'selected native goal', status: 'active' } },
      },
    ]);

    await sessionTree(
      { type: 'session_tree', oldLeafId: 'sibling-leaf', newLeafId: 'selected-leaf' },
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
      mode: 'sonar' as const,
      activeTask: 'previous task',
      nativeGoal: { objective: 'previous native goal', status: 'active' },
    };
    const { sessionTree } = install(pi, state);
    const getEntries = vi.fn(() => [
      {
        type: 'custom',
        customType: 'maestria_state',
        data: {
          ...createInitialState(),
          mode: 'blitz' as const,
          activeTask: 'sibling task',
          nativeGoal: { objective: 'sibling native goal', status: 'active' },
        },
      },
    ]);
    const getBranch = vi.fn(() => null);

    await sessionTree(
      { type: 'session_tree', oldLeafId: 'sibling-leaf', newLeafId: 'target-leaf' },
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
