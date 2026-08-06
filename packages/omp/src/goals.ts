import type { ExtensionAPI } from '@oh-my-pi/pi-coding-agent';
import type { MaestriaState } from '@/state.js';
import { persistState } from '@/state.js';

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
export function installGoalEventHandlers(pi: ExtensionAPI, state: MaestriaState): void {
  pi.on('goal_updated', (event) => {
    // event.goal is Goal | null. A null goal means the native goal was
    // cleared (e.g. dropped or the runtime committed an empty state), so the
    // mirror must be cleared rather than left stale.
    const nativeGoal = event.goal
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
    if (unchanged) return;

    Object.assign(state, { nativeGoal });
    persistState(pi, state);
  });

  // A session switch moves to a different session file; the previous
  // session's goal must not carry over. Sessions with an active native goal
  // re-emit `goal_updated` through OMP's mode reconciler (onThreadResumed)
  // after the switch, which repopulates the mirror.
  pi.on('session_switch', () => {
    if (state.nativeGoal !== null) {
      Object.assign(state, { nativeGoal: null });
    }
  });
}
