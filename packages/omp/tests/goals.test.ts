import { describe, it, expect, vi } from 'vite-plus/test';
import { installGoalEventHandlers } from '@/goals.js';
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

function install(pi: MockPi, state: MaestriaState) {
  installGoalEventHandlers(pi as any, state);
  const calls = (pi.on as ReturnType<typeof vi.fn>).mock.calls as Array<
    [string, (...args: unknown[]) => unknown]
  >;
  const goalUpdatedCall = calls.find(([event]) => event === 'goal_updated');
  const sessionSwitchCall = calls.find(([event]) => event === 'session_switch');
  expect(goalUpdatedCall).toBeDefined();
  expect(sessionSwitchCall).toBeDefined();
  return { goalUpdated: goalUpdatedCall![1], sessionSwitch: sessionSwitchCall![1] };
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
  it('registers goal_updated and session_switch handlers', () => {
    const pi = createMockPi();
    install(pi, createInitialState());
    const events = (pi.on as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0]);
    expect(events).toContain('goal_updated');
    expect(events).toContain('session_switch');
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
    await goalUpdated({ type: 'goal_updated', goal: { ...NATIVE_GOAL, status: 'completed' } }, {});

    expect(pi.appendEntry).toHaveBeenCalledTimes(2);
    const lastCall = (pi.appendEntry as ReturnType<typeof vi.fn>).mock.calls.at(-1);
    expect(lastCall).toEqual([
      'maestria_state',
      expect.objectContaining({
        nativeGoal: { objective: NATIVE_GOAL.objective, status: 'completed' },
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
      {},
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
      {},
    );

    expect(state.nativeGoal).toBeNull();
    expect(pi.appendEntry).not.toHaveBeenCalled();
  });
});
