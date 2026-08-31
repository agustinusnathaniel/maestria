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

/** The 7-field handoff contract used in delegation. */
export const HANDOFF_FIELDS = [
  'Goal',
  'Context',
  'Requirements',
  'Known problems',
  'Assumptions documented',
  'Success criteria',
  'Next step',
] as const;

/** Result of validating a handoff document against the contract fields. */
export interface HandoffValidation {
  valid: boolean;
  errors: string[];
}

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

/**
 * Validates that a handoff document contains all required fields
 * with non-empty content. Each field is expected in markdown bold format:
 * `**Field:** content`.
 */
export const validateHandoff = (handoff: string): HandoffValidation => {
  const errors: string[] = [];
  for (const field of HANDOFF_FIELDS) {
    // Match field header and capture content up to the next field or end of string.
    // This avoids false positives when an empty field is followed by another field's `**` header.
    const pattern = `\\*\\*${field}:\\*\\*(?<content>[\\s\\S]*?)(?=\\n\\*\\*|$)`;
    const match = new RegExp(pattern, 'iu').exec(handoff);
    const content = match?.groups?.content?.trim();
    if (content === undefined || content === '') {
      errors.push(`Missing or empty field: "${field}"`);
    }
  }
  return { errors, valid: errors.length === 0 };
};
