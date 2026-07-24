import type { MaestriaState, HandoffEntry, SubagentStatusInfo } from './types.js';
import { HANDOFF_HISTORY_CAP, FILE_HISTORY_CAP } from './types.js';

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
  const entry: HandoffEntry = { from, to, task, timestamp: Date.now() };
  const history = [entry, ...state.handoffHistory].slice(0, HANDOFF_HISTORY_CAP);
  return { ...state, handoffHistory: history };
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
  return { ...state, reviewMode: active };
}

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
