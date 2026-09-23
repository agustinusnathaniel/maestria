/** Shared state management for Pi-family packages (no platform dependencies). */

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

/** Host platform native goal mirror (objective text and status only). */
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

export const createInitialState = (): MaestriaState => ({
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
});

const prependDeduped = (files: string[], path: string, cap: number): string[] => {
  const filtered = files.filter((f) => f !== path);
  return [path, ...filtered].slice(0, cap);
};

export const recordHandoff = (
  state: MaestriaState,
  from: string,
  to: string,
  task: string,
): MaestriaState => {
  const entry: HandoffEntry = { from, task, timestamp: Date.now(), to };
  const history = [entry, ...state.handoffHistory].slice(0, HANDOFF_HISTORY_CAP);
  return { ...state, handoffHistory: history };
};

export const recordFileModified = (state: MaestriaState, path: string): MaestriaState => ({
  ...state,
  filesModified: prependDeduped(state.filesModified, path, FILE_HISTORY_CAP),
});

export const recordFileRead = (state: MaestriaState, path: string): MaestriaState => ({
  ...state,
  filesRead: prependDeduped(state.filesRead, path, FILE_HISTORY_CAP),
});

export const recordSpecialistDelegated = (state: MaestriaState, name: string): MaestriaState => {
  if (state.specialistsDelegated.includes(name)) {
    return state;
  }
  return { ...state, specialistsDelegated: [...state.specialistsDelegated, name] };
};

export const exitReviewMode = (
  state: MaestriaState,
): {
  state: MaestriaState;
  originalModel: string | null;
  originalTools: string[] | null;
} => ({
  originalModel: state.originalModel,
  originalTools: state.originalTools,
  state: {
    ...state,
    originalModel: null,
    originalTools: null,
    reviewMode: false,
  },
});

// ── Persistence ──

export const persistState = (
  pi: { appendEntry: (type: string, data: unknown) => void },
  state: MaestriaState,
): void => {
  pi.appendEntry('maestria_state', { ...state });
};

// ── Session restore ──

/** Minimal persisted session entry shape for restore logic. */
export interface SessionEntry {
  type: string;
  customType?: string;
  data?: unknown;
}

export interface SessionBranchContext {
  sessionManager?: { getBranch?: () => unknown };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** Read the current host session branch, or null when unavailable. Never use getEntries (whole tree). */
export const readSessionBranch = (ctx?: SessionBranchContext | null): SessionEntry[] | null => {
  const sessionManager = ctx?.sessionManager;
  if (typeof sessionManager?.getBranch !== 'function') {
    return null;
  }

  const branch = sessionManager.getBranch();
  return Array.isArray(branch) ? branch : null;
};

/** Fresh state from the last persisted `maestria_state` entry on the branch. */
export const stateFromSessionEntries = (entries?: SessionEntry[] | null): MaestriaState => {
  const next = createInitialState();
  if (!entries) {
    return next;
  }

  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const entry = entries[i];
    if (entry.type === 'custom' && entry.customType === 'maestria_state') {
      if (isRecord(entry.data)) {
        Object.assign(next, entry.data);
      }
      break;
    }
  }

  return next;
};

/** Replace state with a snapshot, deleting stale keys so absent fields do not leak. */
export const replaceState = (state: MaestriaState, next: MaestriaState): void => {
  for (const key of Object.keys(state)) {
    Reflect.deleteProperty(state, key);
  }
  Object.assign(state, next);
};

// ── Render ──

export const renderMaestriaSummary = (state: MaestriaState): string => {
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
};
