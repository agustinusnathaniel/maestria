import type { ExtensionAPI } from '@oh-my-pi/pi-coding-agent';

import type { MaestriaState } from '@/state.js';
import { createInitialState, persistState } from '@/state.js';

export interface GoalApi {
  appendEntry: (type: string, data: unknown) => void;
  on: (event: string, handler: (event: unknown, ctx: unknown) => Promise<void> | void) => void;
}

interface PersistedStateEntry {
  type: string;
  customType?: string;
  mode?: string;
  data?: unknown;
}

type NativeGoalStatus = 'active' | 'paused' | 'budget-limited';

interface NativeGoalEvent {
  goal: { objective: string; status: string } | null;
}

interface SessionContext {
  sessionManager: {
    getBranch: () => unknown;
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isNativeGoalEvent = (value: unknown): value is NativeGoalEvent => {
  if (!isRecord(value)) {
    return false;
  }
  if (value.goal === null) {
    return true;
  }
  return (
    isRecord(value.goal) &&
    typeof value.goal.objective === 'string' &&
    typeof value.goal.status === 'string'
  );
};

const isSessionContext = (value: unknown): value is SessionContext => {
  if (!isRecord(value)) {
    return false;
  }
  return isRecord(value.sessionManager) && typeof value.sessionManager.getBranch === 'function';
};

const currentSessionEntries = (ctx: SessionContext): PersistedStateEntry[] | null => {
  // getBranch() is the public current-session view and avoids restoring state
  // from a sibling branch in the same session tree. Never fall back to
  // getEntries(), which spans the entire session tree.
  const sessionManager = ctx?.sessionManager;
  if (typeof sessionManager?.getBranch !== 'function') {
    return null;
  }

  const branch = sessionManager.getBranch();
  return Array.isArray(branch) ? branch : null;
};

const isNativeGoalStatus = (value: unknown): value is NativeGoalStatus =>
  value === 'active' || value === 'paused' || value === 'budget-limited';

const nativeGoalFromSessionEntries = (
  entries: PersistedStateEntry[],
): MaestriaState['nativeGoal'] => {
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const entry = entries[i];
    if (entry.type !== 'mode_change') {
      continue;
    }
    if (entry.mode !== 'goal' && entry.mode !== 'goal_paused') {
      return null;
    }
    if (!isRecord(entry.data) || !isRecord(entry.data.goal)) {
      return null;
    }

    const { objective } = entry.data.goal;
    const { status } = entry.data.goal;
    if (typeof objective !== 'string' || !isNativeGoalStatus(status)) {
      return null;
    }
    return { objective, status };
  }

  return null;
};

/**
 * Replace the mutable extension state with the target session's state.
 *
 * The native goal mirror is host-derived rather than Maestria-owned. It is
 * restored from the target branch's public `mode_change` representation when
 * that representation is valid. Otherwise it is reset to unknown (`null`) and
 * remains so until the target session publishes a public `goal_updated` event.
 * All other persisted Maestria fields are restored from the current branch.
 */
export const restoreMaestriaStateForSession = (state: MaestriaState, ctx: SessionContext): void => {
  const next = createInitialState();
  const entries = currentSessionEntries(ctx);

  if (!entries) {
    Object.assign(state, next);
    return;
  }

  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const entry = entries[i];
    if (entry.type !== 'custom' || entry.customType !== 'maestria_state') {
      continue;
    }
    if (isRecord(entry.data)) {
      Object.assign(next, entry.data);
    }
    break;
  }

  // Do not trust a copied/persisted host mirror. Fork and handoff can copy the
  // Maestria entry before OMP reconciles its native goal, so only OMP's public
  // mode entry or a later goal_updated event may establish this mirror.
  next.nativeGoal = nativeGoalFromSessionEntries(entries);

  Object.assign(state, next);
};

/**
 * Mirror OMP's native goal state into Maestria state.
 *
 * OMP exposes goal mode through the public `goal_updated` extension event,
 * which carries the current `goal` (or `null` when the goal was cleared)
 * and an optional goal-mode `state`. We deliberately do not invoke OMP's
 * `/goal`, `/plan`, or `/vibe` command handlers, and we do not attempt to
 * activate native goal mode programmatically: goal mode remains
 * user/model-driven and we only observe its published events.
 *
 * The mirror writes only `state.nativeGoal` and never touches Maestria-only
 * state (`handoffHistory`, `filesModified`, `blockers`, specialist status,
 * mode, review state, etc.). It is persisted through the existing
 * `maestria_state` mechanism so session restoration keeps working.
 */
export const installGoalEventHandlers = (pi: GoalApi, state: MaestriaState): void => {
  pi.on('goal_updated', (event) => {
    if (!isNativeGoalEvent(event)) {
      return;
    }
    // OMP emits complete/dropped goals as non-null terminal objects. They are
    // meaningful lifecycle transitions, but are no longer current goals, so
    // clear the mirror rather than presenting a terminal goal as active.
    const isTerminal = event.goal?.status === 'complete' || event.goal?.status === 'dropped';
    const nativeGoal =
      event.goal && !isTerminal
        ? { objective: event.goal.objective, status: event.goal.status }
        : null;

    // OMP re-emits goal_updated on session resume and goal-bookkeeping
    // churn. Only persist when the mirror actually changed - including
    // transitions to and from null - so identical mirrors don't rewrite the
    // same maestria_state entry. Only objective/status are compared because
    // they are the entire mirror surface.
    const unchanged =
      state.nativeGoal?.objective === nativeGoal?.objective &&
      state.nativeGoal?.status === nativeGoal?.status;
    if (unchanged) {
      return;
    }

    Object.assign(state, { nativeGoal });
    persistState(pi, state);
  });

  // Every transition is a new target-session boundary. Rehydrate all
  // Maestria fields from that target, including only public native goal state.
  pi.on('session_switch', (_event, ctx) => {
    if (isSessionContext(ctx)) {
      restoreMaestriaStateForSession(state, ctx);
    }
  });
  pi.on('session_branch', (_event, ctx) => {
    if (isSessionContext(ctx)) {
      restoreMaestriaStateForSession(state, ctx);
    }
  });
  pi.on('session_tree', (_event, ctx) => {
    if (isSessionContext(ctx)) {
      restoreMaestriaStateForSession(state, ctx);
    }
  });
};

export const createGoalApi = (pi: ExtensionAPI): GoalApi => ({
  appendEntry: (type, data) => {
    pi.appendEntry(type, data);
  },
  on: (event, handler) => {
    if (event === 'goal_updated') {
      pi.on('goal_updated', async (eventData, ctx) => {
        await handler(eventData, ctx);
      });
    }
    if (event === 'session_switch') {
      pi.on('session_switch', async (eventData, ctx) => {
        await handler(eventData, ctx);
      });
    }
    if (event === 'session_branch') {
      pi.on('session_branch', async (eventData, ctx) => {
        await handler(eventData, ctx);
      });
    }
    if (event === 'session_tree') {
      pi.on('session_tree', async (eventData, ctx) => {
        await handler(eventData, ctx);
      });
    }
  },
});
