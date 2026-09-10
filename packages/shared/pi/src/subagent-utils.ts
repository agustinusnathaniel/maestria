/**
 * Shared subagent validation utilities for Maestria platform packages.
 *
 * Pure TypeScript - no platform-specific dependencies.
 * Imported by both @maestria/omp and @maestria/pi to eliminate duplication.
 *
 * @module
 */

/** Maestria cross-extension event names. */
export const MAESTRIA_EVENTS = {
  REVIEW_ACTIVATED: 'maestria:review:activated',
  REVIEW_DEACTIVATED: 'maestria:review:deactivated',
  SUBAGENT_COMPLETED: 'maestria:subagent:completed',
  SUBAGENT_FAILED: 'maestria:subagent:failed',
  SUBAGENT_STARTED: 'maestria:subagent:started',
} as const;

/** The set of specialist agent types maestria supports. */
export const ALLOWED_AGENTS = [
  'adventurer',
  'architect',
  'builder',
  'diagnose',
  'planner',
  'reviewer',
  'writer',
] as const;

/** A valid specialist agent name. */
export type AllowedAgent = (typeof ALLOWED_AGENTS)[number];

/**
 * Asserts that `agent` is a known maestria specialist.
 * @throws {Error} if the agent name is not in ALLOWED_AGENTS.
 */
export const assertValidAgent = (agent: string): asserts agent is AllowedAgent => {
  if (!ALLOWED_AGENTS.some((allowedAgent) => allowedAgent === agent)) {
    throw new Error(`Unknown agent: "${agent}". Allowed: ${ALLOWED_AGENTS.join(', ')}`);
  }
};

/**
 * Asserts that `task` is a non-empty, non-whitespace string.
 * @throws {Error} with the given label if task is falsy or all-whitespace.
 */
export const assertNonEmptyTask = (
  task: string | undefined,
  label: string,
): asserts task is string => {
  if (task === undefined || task === null || task === '' || !task.trim()) {
    throw new Error(label);
  }
};
