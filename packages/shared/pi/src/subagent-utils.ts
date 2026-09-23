/** Shared subagent validation utilities for Pi-family packages. */

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

/** Asserts that `agent` is a known maestria specialist. */
export const assertValidAgent: (agent: string) => asserts agent is AllowedAgent = (agent) => {
  if (!ALLOWED_AGENTS.some((allowedAgent) => allowedAgent === agent)) {
    throw new Error(`Unknown agent: "${agent}". Allowed: ${ALLOWED_AGENTS.join(', ')}`);
  }
};

/** Asserts that `task` is a non-empty string, failing with the given label. */
export const assertNonEmptyTask: (
  task: string | undefined,
  label: string,
) => asserts task is string = (task, label) => {
  if (task === undefined || task === null || task === '' || !task.trim()) {
    throw new Error(label);
  }
};
