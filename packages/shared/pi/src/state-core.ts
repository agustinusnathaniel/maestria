/**
 * Shared state management for Maestria platform packages.
 *
 * Pure TypeScript - no platform-specific dependencies.
 * Provides shared state-management types, transforms, persistence, and rendering
 * consumed directly by @maestria/omp and @maestria/pi.
 *
 * @module
 */

// ── Types ──

export type ModeKeyword = 'fein' | 'sonar' | 'blitz';

export const HANDOFF_HISTORY_CAP = 5;
export const FILE_HISTORY_CAP = 10;

export interface HandoffEntry {
  from: string;
  to: string;
  task: string;
  timestamp: number;
}

export interface SubagentStatusInfo {
  type: string;
  status: string;
  startedAt: number;
  completedAt?: number;
}

/**
 * Mirror of the host platform's native goal (e.g. OMP goal mode).
 *
 * Platform-agnostic by design: only the objective text and status are
 * carried so shared state stays free of platform-specific types.
 */
export interface NativeGoalMirror {
  objective: string;
  status: string;
}

export interface MaestriaState {
  mode: ModeKeyword | null;
  activeTask: string;
  completionPromise: string;
  specialistsDelegated: string[];
  blockers: string[];
  filesModified: string[];
  filesRead: string[];
  handoffHistory: HandoffEntry[];
  reviewMode: boolean;
  originalModel: string | null;
  originalTools: string[] | null;
  subagentStatus: Record<string, SubagentStatusInfo>;
  reviewModel: string | null;
  nativeGoal: NativeGoalMirror | null;
}

// ── Transforms ──

export function createInitialState(): MaestriaState {
  return {
    activeTask: '',
    blockers: [],
    completionPromise: '',
    filesModified: [],
    filesRead: [],
    handoffHistory: [],
    mode: null,
    nativeGoal: null,
    originalModel: null,
    originalTools: null,
    reviewMode: false,
    reviewModel: null,
    specialistsDelegated: [],
    subagentStatus: {},
  };
}

function prependDeduped(files: string[], path: string, cap: number): string[] {
  const filtered = files.filter((f) => f !== path);
  return [path, ...filtered].slice(0, cap);
}

export function recordHandoff(
  state: MaestriaState,
  from: string,
  to: string,
  task: string,
): MaestriaState {
  const entry: HandoffEntry = { from, task, timestamp: Date.now(), to };
  const history = [entry, ...state.handoffHistory].slice(0, HANDOFF_HISTORY_CAP);
  return { ...state, handoffHistory: history };
}

export function recordFileModified(state: MaestriaState, path: string): MaestriaState {
  return { ...state, filesModified: prependDeduped(state.filesModified, path, FILE_HISTORY_CAP) };
}

export function recordFileRead(state: MaestriaState, path: string): MaestriaState {
  return { ...state, filesRead: prependDeduped(state.filesRead, path, FILE_HISTORY_CAP) };
}

export function recordSpecialistDelegated(state: MaestriaState, name: string): MaestriaState {
  if (state.specialistsDelegated.includes(name)) {
    return state;
  }
  return { ...state, specialistsDelegated: [...state.specialistsDelegated, name] };
}

export function recordSubagentStatus(
  state: MaestriaState,
  id: string,
  info: SubagentStatusInfo,
): MaestriaState {
  return { ...state, subagentStatus: { ...state.subagentStatus, [id]: info } };
}

export function setReviewMode(state: MaestriaState, active: boolean): MaestriaState {
  return { ...state, reviewMode: active };
}

export function exitReviewMode(state: MaestriaState): {
  state: MaestriaState;
  originalModel: string | null;
  originalTools: string[] | null;
} {
  return {
    originalModel: state.originalModel,
    originalTools: state.originalTools,
    state: {
      ...state,
      originalModel: null,
      originalTools: null,
      reviewMode: false,
    },
  };
}

// ── Persistence ──

export function persistState(
  pi: { appendEntry: (type: string, data: unknown) => void },
  state: MaestriaState,
): void {
  pi.appendEntry('maestria_state', { ...state });
}

// ── Render ──

export function renderMaestriaSummary(state: MaestriaState): string {
  const parts: string[] = [];

  if (state.mode) {
    parts.push(`**Mode:** ${state.mode.toUpperCase()}`);
  }

  if (state.reviewModel !== null && state.reviewModel !== undefined && state.reviewModel !== '') {
    parts.push(`**Review Model:** ${state.reviewModel}`);
  }

  if (state.activeTask) {
    parts.push(`**Goal:** ${state.activeTask}`);
  }

  if (state.nativeGoal) {
    parts.push(`**Native Goal:** ${state.nativeGoal.objective} (${state.nativeGoal.status})`);
  }

  if (state.completionPromise) {
    parts.push(`**Completion Promise:** ${state.completionPromise}`);
  }

  if (state.specialistsDelegated.length > 0) {
    parts.push(`**Specialists Delegated:** ${state.specialistsDelegated.join(', ')}`);
  }

  if (state.blockers.length > 0) {
    parts.push('**Blockers:**');
    for (const blocker of state.blockers) {
      parts.push(`- ${blocker}`);
    }
  }

  const fileSubs: string[] = [];
  if (state.filesModified.length > 0) {
    fileSubs.push(`**Modified:** ${state.filesModified.join(', ')}`);
  }
  if (state.filesRead.length > 0) {
    fileSubs.push(`**Read:** ${state.filesRead.join(', ')}`);
  }
  if (fileSubs.length > 0) {
    parts.push(`**Files:** ${fileSubs.join('; ')}`);
  }

  if (state.handoffHistory.length > 0) {
    parts.push('**Recent Handoffs:**');
    for (const entry of state.handoffHistory) {
      parts.push(`- ${entry.from} → ${entry.to}: ${entry.task}`);
    }
  }

  return parts.join('\n\n');
}
