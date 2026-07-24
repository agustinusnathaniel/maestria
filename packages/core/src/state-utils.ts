
const HANDOFF_HISTORY_CAP = 5;
const FILE_HISTORY_CAP = 10;

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

export interface MaestriaState {
  mode: string | null;
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
  /** Model ID to use when entering review mode. Null = no preference. */
  reviewModel: string | null;
}

export function createInitialState(): MaestriaState {
  return {
    mode: null,
    activeTask: '',
    completionPromise: '',
    specialistsDelegated: [],
    blockers: [],
    filesModified: [],
    filesRead: [],
    handoffHistory: [],
    reviewMode: false,
    originalModel: null,
    originalTools: null,
    subagentStatus: {},
    reviewModel: null,
  };
}

export function recordHandoff(
  state: MaestriaState,
  from: string,
  to: string,
  task: string,
): MaestriaState {
  const entry: HandoffEntry = { from, to, task, timestamp: Date.now() };
  const history = [entry, ...state.handoffHistory].slice(0, HANDOFF_HISTORY_CAP);
  return { ...state, handoffHistory: history };
}

function prependDeduped(files: string[], path: string, cap: number): string[] {
  const filtered = files.filter((f) => f !== path);
  return [path, ...filtered].slice(0, cap);
}

export function recordFileModified(state: MaestriaState, path: string): MaestriaState {
  return { ...state, filesModified: prependDeduped(state.filesModified, path, FILE_HISTORY_CAP) };
}

export function recordFileRead(state: MaestriaState, path: string): MaestriaState {
  return { ...state, filesRead: prependDeduped(state.filesRead, path, FILE_HISTORY_CAP) };
}

export function recordSubagentStatus(
  state: MaestriaState,
  id: string,
  info: SubagentStatusInfo,
): MaestriaState {
  return { ...state, subagentStatus: { ...state.subagentStatus, [id]: info } };
}

export function setReviewMode(state: MaestriaState, active: boolean): MaestriaState {
  return {
    ...state,
    reviewMode: active,
  };
}

/**
 * Exit review mode and return the original model/tools for restoration.
 * Returns a new state (immutable) with review mode cleared and the
 * saved originals so the caller can pass them to pi.setModel/setActiveTools.
 */
export function exitReviewMode(state: MaestriaState): {
  state: MaestriaState;
  originalModel: string | null;
  originalTools: string[] | null;
} {
  return {
    state: {
      ...state,
      reviewMode: false,
      originalModel: null,
      originalTools: null,
    },
    originalModel: state.originalModel,
    originalTools: state.originalTools,
  };
}

export function renderMaestriaSummary(state: MaestriaState): string {
  const parts: string[] = [];

  if (state.mode) {
    parts.push(`**Mode:** ${state.mode.toUpperCase()}`);
  }

  if (state.reviewModel) {
    parts.push(`**Review Model:** ${state.reviewModel}`);
  }

  if (state.activeTask) {
    parts.push(`**Goal:** ${state.activeTask}`);
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

export { HANDOFF_HISTORY_CAP, FILE_HISTORY_CAP };
