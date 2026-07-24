/**
 * Shared subagent validation utilities for Maestria platform packages.
 *
 * Pure TypeScript — no platform-specific dependencies.
 * Imported by both @maestria/omp and @maestria/pi to eliminate duplication.
 *
 * @module
 */

/** Maestria cross-extension event names. */
export const MAESTRIA_EVENTS = {
  REVIEW_ACTIVATED: 'maestria:review:activated',
  REVIEW_DEACTIVATED: 'maestria:review:deactivated',
  SUBAGENT_STARTED: 'maestria:subagent:started',
  SUBAGENT_COMPLETED: 'maestria:subagent:completed',
  SUBAGENT_FAILED: 'maestria:subagent:failed',
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

/** The 6-field handoff contract used in delegation. */
export const HANDOFF_FIELDS = [
  'Goal',
  'Context',
  'Requirements',
  'Known problems',
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
export function assertValidAgent(agent: string): asserts agent is AllowedAgent {
  if (!ALLOWED_AGENTS.includes(agent as AllowedAgent)) {
    throw new Error(`Unknown agent: "${agent}". Allowed: ${ALLOWED_AGENTS.join(', ')}`);
  }
}

/**
 * Asserts that `task` is a non-empty, non-whitespace string.
 * @throws {Error} with the given label if task is falsy or all-whitespace.
 */
export function assertNonEmptyTask(
  task: string | undefined,
  label: string,
): asserts task is string {
  if (!task || !task.trim()) {
    throw new Error(label);
  }
}

/**
 * Validates that a handoff document contains all required fields
 * with non-empty content. Each field is expected in markdown bold format:
 * `**Field:** content`.
 */
export function validateHandoff(handoff: string): HandoffValidation {
  const errors: string[] = [];
  for (const field of HANDOFF_FIELDS) {
    // Check for markdown bold field **Field:** followed by at least one non-whitespace character
    const regex = new RegExp(`\\*\\*${field}:\\*\\*[\\s\\S]*?\\S`, 'i');
    if (!regex.test(handoff)) {
      errors.push(`Missing or empty field: "${field}"`);
    }
  }
  return { valid: errors.length === 0, errors };
}
