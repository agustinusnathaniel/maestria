/**
 * Shared state management for Maestria platform packages.
 *
 * Pure TypeScript — no platform-specific dependencies.
 * Provides shared state-management types, transforms, persistence, and rendering
 * consumed directly by @maestria/omp and @maestria/pi.
 *
 * @module
 */

import type { WorktreeContentManifest } from './manifest-core.js';
import { sameWorktreeContentManifest } from './manifest-core.js';

// ── Types ──

export type ModeKeyword = 'fein' | 'sonar' | 'blitz';
export type LandingReviewPhase =
  | 'execution'
  | 'armed'
  | 'reviewing'
  | 'approved'
  | 'rejected'
  | 'failed'
  | 'stale';

export const LANDING_REVIEW_VERDICT_SCHEMA = 'maestria.landing-review.v1' as const;
export const LANDING_REVIEW_VERDICT_INSTRUCTIONS =
  `Return only one JSON object with exactly these keys: schema, verdict, artifactDigest, findings. ` +
  `Use schema "${LANDING_REVIEW_VERDICT_SCHEMA}", verdict "approved" or "rejected", the supplied ` +
  `artifact digest, and findings as an array of strings. Do not wrap the JSON in markdown.`;

export interface LandingReviewVerdict {
  schema: typeof LANDING_REVIEW_VERDICT_SCHEMA;
  verdict: 'approved' | 'rejected';
  artifactDigest: string;
  findings: string[];
}

export interface LandingReviewBinding {
  invocationId: string;
  artifactDigest: string;
  worktreeManifest: WorktreeContentManifest | null;
  resultDigest: string | null;
  verdict: LandingReviewVerdict | null;
}

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
  landingReview: LandingReviewPhase;
  landingReviewBinding: LandingReviewBinding | null;
  landingReviewFailureReason: string | null;
  landingReviewShippingStarted: boolean;
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
    mode: null,
    landingReview: 'execution',
    landingReviewBinding: null,
    landingReviewFailureReason: null,
    landingReviewShippingStarted: false,
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
    nativeGoal: null,
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

export function resetLandingReview(state: MaestriaState): MaestriaState {
  if (state.landingReview === 'armed' || state.landingReview === 'reviewing') {
    return markLandingReviewStale(state, 'A new turn invalidated the in-flight review.');
  }
  return {
    ...state,
    landingReview: 'execution',
    landingReviewBinding: null,
    landingReviewFailureReason: null,
    landingReviewShippingStarted: false,
  };
}

export function armLandingReview(
  state: MaestriaState,
  invocationId: string,
  artifact: string | WorktreeContentManifest,
): MaestriaState {
  const artifactDigest = typeof artifact === 'string' ? artifact : artifact.digest;
  const worktreeManifest = typeof artifact === 'string' ? null : artifact;
  if (state.landingReview !== 'execution' || !invocationId || !artifactDigest) {
    return markLandingReviewFailed(state, 'Landing review could not be armed safely.');
  }
  return {
    ...state,
    landingReview: 'armed',
    landingReviewFailureReason: null,
    landingReviewShippingStarted: false,
    landingReviewBinding: {
      invocationId,
      artifactDigest,
      worktreeManifest,
      resultDigest: null,
      verdict: null,
    },
  };
}

export function beginLandingReview(state: MaestriaState, invocationId: string): MaestriaState {
  if (
    state.landingReview !== 'armed' ||
    !state.landingReviewBinding ||
    state.landingReviewBinding.invocationId !== invocationId
  ) {
    return markLandingReviewFailed(
      state,
      'The reviewer invocation did not match the armed review.',
    );
  }
  return { ...state, landingReview: 'reviewing', landingReviewFailureReason: null };
}

export function markLandingReviewFailed(state: MaestriaState, reason?: string): MaestriaState {
  return {
    ...state,
    landingReview: 'failed',
    landingReviewFailureReason: reason ?? 'Trusted landing reviewer validation failed.',
  };
}

export function markLandingReviewStale(state: MaestriaState, reason?: string): MaestriaState {
  return {
    ...state,
    landingReview: 'stale',
    landingReviewFailureReason: reason ?? 'The approved review is no longer current.',
  };
}

export function markLandingReviewShippingStarted(state: MaestriaState): MaestriaState {
  if (state.landingReview !== 'approved') return state;
  return { ...state, landingReviewShippingStarted: true };
}

function isSha256Digest(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function isStrictVerdictShape(value: unknown): value is LandingReviewVerdict {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (keys.join(',') !== 'artifactDigest,findings,schema,verdict') return false;
  return (
    record.schema === LANDING_REVIEW_VERDICT_SCHEMA &&
    (record.verdict === 'approved' || record.verdict === 'rejected') &&
    isSha256Digest(record.artifactDigest) &&
    Array.isArray(record.findings) &&
    record.findings.every((finding) => typeof finding === 'string')
  );
}

export interface LandingReviewValidation {
  valid: boolean;
  reason?: string;
  verdict?: LandingReviewVerdict;
}

export function validateLandingReviewVerdict(
  value: unknown,
  binding: LandingReviewBinding | null,
  actualArtifact: string | WorktreeContentManifest,
  actualResultDigest: string,
): LandingReviewValidation {
  if (!binding) return { valid: false, reason: 'No reviewer invocation is bound.' };
  const actualArtifactDigest =
    typeof actualArtifact === 'string' ? actualArtifact : actualArtifact.digest;
  if (!isSha256Digest(actualArtifactDigest) || actualArtifactDigest !== binding.artifactDigest) {
    return { valid: false, reason: 'The reviewed artifact digest no longer matches.' };
  }
  if (
    typeof actualArtifact !== 'string' &&
    !sameWorktreeContentManifest(binding.worktreeManifest, actualArtifact)
  ) {
    return { valid: false, reason: 'The reviewed worktree manifest no longer matches.' };
  }
  if (!isSha256Digest(actualResultDigest)) {
    return { valid: false, reason: 'The reviewer result has no valid digest.' };
  }
  if (!isStrictVerdictShape(value)) {
    return { valid: false, reason: 'The reviewer result is not a strict structured verdict.' };
  }
  if (value.artifactDigest !== binding.artifactDigest) {
    return { valid: false, reason: 'The verdict is bound to a different artifact.' };
  }
  return { valid: true, verdict: value };
}

export function recordLandingReviewVerdict(
  state: MaestriaState,
  value: unknown,
  actualArtifact: string | WorktreeContentManifest,
  actualResultDigest: string,
): MaestriaState {
  if (state.landingReview !== 'reviewing') {
    return markLandingReviewFailed(state, 'A verdict arrived outside the reviewing state.');
  }
  const validation = validateLandingReviewVerdict(
    value,
    state.landingReviewBinding,
    actualArtifact,
    actualResultDigest,
  );
  if (!validation.valid || !validation.verdict || !state.landingReviewBinding) {
    if (
      validation.reason === 'The reviewed artifact digest no longer matches.' ||
      validation.reason === 'The reviewed worktree manifest no longer matches.'
    ) {
      return markLandingReviewStale(state, validation.reason);
    }
    return markLandingReviewFailed(state, validation.reason);
  }
  return {
    ...state,
    landingReview: validation.verdict.verdict,
    landingReviewBinding: {
      ...state.landingReviewBinding,
      worktreeManifest:
        typeof actualArtifact === 'string'
          ? state.landingReviewBinding.worktreeManifest
          : actualArtifact,
      resultDigest: actualResultDigest,
      verdict: validation.verdict,
    },
    landingReviewShippingStarted: false,
  };
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

  if (state.reviewModel) {
    parts.push(`**Review Model:** ${state.reviewModel}`);
  }

  if (state.landingReview !== 'execution' || state.landingReviewFailureReason) {
    parts.push(`**Landing Review:** ${state.landingReview}`);
    if (state.landingReviewFailureReason) {
      parts.push(`**Landing Review Limitation:** ${state.landingReviewFailureReason}`);
    }
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
