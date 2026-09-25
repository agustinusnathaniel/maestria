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
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Read the current host session branch, or null when unavailable. Never use getEntries (whole tree). */
export const readSessionBranch = (ctx?: SessionBranchContext | null): SessionEntry[] | null => {
  const sessionManager = ctx?.sessionManager;
  if (typeof sessionManager?.getBranch !== 'function') {
    return null;
  }

  try {
    const branch = sessionManager.getBranch();
    return Array.isArray(branch) ? branch : null;
  } catch {
    return null;
  }
};

interface OwnField {
  present: boolean;
  value: unknown;
}

const UNSAFE_STATE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const readOwnField = (record: Record<string, unknown>, key: string): OwnField => {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    if (descriptor === undefined) {
      return { present: false, value: undefined };
    }
    return {
      present: true,
      value: 'value' in descriptor ? descriptor.value : undefined,
    };
  } catch {
    return { present: true, value: undefined };
  }
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const normalizeStringArray = (value: unknown, cap?: number): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const normalized = value.filter((item): item is string => typeof item === 'string');
  return cap === undefined ? normalized : normalized.slice(0, cap);
};

const normalizeHandoffEntry = (value: unknown): HandoffEntry | null => {
  if (!isRecord(value)) {
    return null;
  }
  const from = readOwnField(value, 'from').value;
  const to = readOwnField(value, 'to').value;
  const task = readOwnField(value, 'task').value;
  const timestamp = readOwnField(value, 'timestamp').value;
  if (
    typeof from !== 'string' ||
    typeof to !== 'string' ||
    typeof task !== 'string' ||
    !isFiniteNumber(timestamp)
  ) {
    return null;
  }
  return { from, task, timestamp, to };
};

const normalizeHandoffHistory = (value: unknown): HandoffEntry[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map(normalizeHandoffEntry)
    .filter((entry): entry is HandoffEntry => entry !== null)
    .slice(0, HANDOFF_HISTORY_CAP);
};

const normalizeNativeGoal = (value: unknown): NativeGoalMirror | null => {
  if (!isRecord(value)) {
    return null;
  }
  const objective = readOwnField(value, 'objective').value;
  const status = readOwnField(value, 'status').value;
  if (typeof objective !== 'string' || typeof status !== 'string') {
    return null;
  }
  return { objective, status };
};

const normalizeSubagentInfo = (value: unknown): SubagentStatusInfo | null => {
  if (!isRecord(value)) {
    return null;
  }
  const type = readOwnField(value, 'type').value;
  const status = readOwnField(value, 'status').value;
  const startedAt = readOwnField(value, 'startedAt').value;
  if (typeof type !== 'string' || typeof status !== 'string' || !isFiniteNumber(startedAt)) {
    return null;
  }
  const completedAtField = readOwnField(value, 'completedAt');
  if (!completedAtField.present) {
    return { startedAt, status, type };
  }
  return isFiniteNumber(completedAtField.value)
    ? { completedAt: completedAtField.value, startedAt, status, type }
    : { startedAt, status, type };
};

const normalizeSubagentStatus = (value: unknown): Record<string, SubagentStatusInfo> => {
  if (!isRecord(value)) {
    return {};
  }
  const normalized: Record<string, SubagentStatusInfo> = {};
  let keys: readonly (string | symbol)[];
  try {
    keys = Reflect.ownKeys(value);
  } catch {
    return normalized;
  }
  for (const key of keys) {
    if (typeof key !== 'string' || UNSAFE_STATE_KEYS.has(key)) {
      continue;
    }
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      continue;
    }
    if (descriptor === undefined || !('value' in descriptor)) {
      continue;
    }
    const info = normalizeSubagentInfo(descriptor.value);
    if (info !== null) {
      normalized[key] = info;
    }
  }
  return normalized;
};

const normalizePersistedState = (value: unknown): MaestriaState | null => {
  if (!isRecord(value)) {
    return null;
  }
  const next = createInitialState();
  const activeTask = readOwnField(value, 'activeTask');
  if (activeTask.present && typeof activeTask.value === 'string') {
    next.activeTask = activeTask.value;
  }
  next.blockers = normalizeStringArray(readOwnField(value, 'blockers').value);
  const completionPromise = readOwnField(value, 'completionPromise');
  if (completionPromise.present && typeof completionPromise.value === 'string') {
    next.completionPromise = completionPromise.value;
  }
  next.filesModified = normalizeStringArray(
    readOwnField(value, 'filesModified').value,
    FILE_HISTORY_CAP,
  );
  next.filesRead = normalizeStringArray(readOwnField(value, 'filesRead').value, FILE_HISTORY_CAP);
  next.handoffHistory = normalizeHandoffHistory(readOwnField(value, 'handoffHistory').value);

  const mode = readOwnField(value, 'mode');
  if (!mode.present) {
    next.mode = null;
  } else if (
    mode.value === null ||
    mode.value === 'fein' ||
    mode.value === 'sonar' ||
    mode.value === 'blitz'
  ) {
    next.mode = mode.value;
  } else {
    next.mode = 'fein';
  }

  next.nativeGoal = normalizeNativeGoal(readOwnField(value, 'nativeGoal').value);
  const originalModel = readOwnField(value, 'originalModel');
  next.originalModel = typeof originalModel.value === 'string' ? originalModel.value : null;
  const originalTools = readOwnField(value, 'originalTools');
  next.originalTools = Array.isArray(originalTools.value)
    ? normalizeStringArray(originalTools.value)
    : null;
  const reviewMode = readOwnField(value, 'reviewMode');
  if (!reviewMode.present) {
    next.reviewMode = false;
  } else if (typeof reviewMode.value === 'boolean') {
    next.reviewMode = reviewMode.value;
  } else {
    next.reviewMode = true;
  }
  const reviewModel = readOwnField(value, 'reviewModel');
  next.reviewModel = typeof reviewModel.value === 'string' ? reviewModel.value : null;
  next.specialistsDelegated = normalizeStringArray(
    readOwnField(value, 'specialistsDelegated').value,
  );
  next.subagentStatus = normalizeSubagentStatus(readOwnField(value, 'subagentStatus').value);
  return next;
};

/** Fresh state from the last valid persisted `maestria_state` entry on the branch. */
export const stateFromSessionEntries = (entries?: SessionEntry[] | null): MaestriaState => {
  if (!Array.isArray(entries)) {
    return createInitialState();
  }

  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (!isRecord(entry)) {
      continue;
    }
    const type = readOwnField(entry, 'type').value;
    const customType = readOwnField(entry, 'customType').value;
    if (type !== 'custom' || customType !== 'maestria_state') {
      continue;
    }
    const normalized = normalizePersistedState(readOwnField(entry, 'data').value);
    if (normalized !== null) {
      return normalized;
    }
  }

  return createInitialState();
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
