import { describe, it, expect } from 'vite-plus/test';
import {
  ALLOWED_AGENTS,
  HANDOFF_FIELDS,
  MAESTRIA_EVENTS,
  assertValidAgent,
  assertNonEmptyTask,
  validateHandoff,
} from '../src/subagent-utils.js';

// ── Constants ──────────────────────────────────────────────────────

describe('ALLOWED_AGENTS', () => {
  it('contains the 7 maestria specialist agents', () => {
    expect(ALLOWED_AGENTS).toEqual([
      'adventurer',
      'architect',
      'builder',
      'diagnose',
      'planner',
      'reviewer',
      'writer',
    ]);
  });

  it('contains no duplicate agent names', () => {
    expect(new Set(ALLOWED_AGENTS).size).toBe(ALLOWED_AGENTS.length);
  });
});

describe('HANDOFF_FIELDS', () => {
  it('contains the 7 required handoff fields matching the orchestrator delegation pattern', () => {
    expect(HANDOFF_FIELDS).toEqual([
      'Goal',
      'Context',
      'Requirements',
      'Known problems',
      'Assumptions documented',
      'Success criteria',
      'Next step',
    ]);
  });

  it('contains no duplicate field names', () => {
    expect(new Set(HANDOFF_FIELDS).size).toBe(HANDOFF_FIELDS.length);
  });
});

describe('MAESTRIA_EVENTS', () => {
  it('defines all expected maestria cross-extension events', () => {
    expect(MAESTRIA_EVENTS).toEqual({
      REVIEW_ACTIVATED: 'maestria:review:activated',
      REVIEW_DEACTIVATED: 'maestria:review:deactivated',
      SUBAGENT_STARTED: 'maestria:subagent:started',
      SUBAGENT_COMPLETED: 'maestria:subagent:completed',
      SUBAGENT_FAILED: 'maestria:subagent:failed',
    });
  });

  it('uses the maestria:<domain>:<action> naming convention', () => {
    for (const value of Object.values(MAESTRIA_EVENTS)) {
      expect(value).toMatch(/^maestria:[a-z]+:[a-z]+$/);
    }
  });
});

// ── assertValidAgent ───────────────────────────────────────────────

describe('assertValidAgent', () => {
  it('passes for every allowed agent', () => {
    for (const agent of ALLOWED_AGENTS) {
      expect(() => {
        return assertValidAgent(agent);
      }).not.toThrow();
    }
  });

  it('throws for an unknown agent name', () => {
    expect(() => {
      return assertValidAgent('unknown');
    }).toThrow('Unknown agent');
  });

  it('includes the unknown agent name in the error message', () => {
    expect(() => {
      return assertValidAgent('bad-agent');
    }).toThrow('bad-agent');
  });

  it('includes the list of allowed agents in the error message', () => {
    expect(() => {
      return assertValidAgent('bad-agent');
    }).toThrow(`Allowed: ${ALLOWED_AGENTS.join(', ')}`);
  });

  it('throws for empty string', () => {
    expect(() => {
      return assertValidAgent('');
    }).toThrow('Unknown agent');
  });

  it('returns undefined on success', () => {
    expect(assertValidAgent('builder')).toBeUndefined();
  });
});

// ── assertNonEmptyTask ─────────────────────────────────────────────

describe('assertNonEmptyTask', () => {
  it('passes for a non-empty task string', () => {
    expect(() => {
      return assertNonEmptyTask('do something', 'Task is required');
    }).not.toThrow();
  });

  it('passes for a task with leading/trailing whitespace but content', () => {
    expect(() => {
      return assertNonEmptyTask('  valid task  ', 'Task is required');
    }).not.toThrow();
  });

  it('throws for undefined task', () => {
    expect(() => {
      return assertNonEmptyTask(undefined, 'Task is required');
    }).toThrow('Task is required');
  });

  it('throws for empty string', () => {
    expect(() => {
      return assertNonEmptyTask('', 'Task is required');
    }).toThrow('Task is required');
  });

  it('throws for whitespace-only string', () => {
    expect(() => {
      return assertNonEmptyTask('   ', 'Task description must not be blank');
    }).toThrow('Task description must not be blank');
  });

  it('uses the provided label in the error message', () => {
    expect(() => {
      return assertNonEmptyTask('', 'Custom error label');
    }).toThrow('Custom error label');
  });
});

// ── validateHandoff ────────────────────────────────────────────────

describe('validateHandoff', () => {
  it('returns valid=true for a handoff with all 7 fields', () => {
    const handoff = [
      '**Goal:** build feature',
      '**Context:** in repo root',
      '**Requirements:** must be fast',
      '**Known problems:** none',
      '**Assumptions documented:** pipeline must be installed',
      '**Success criteria:** tests pass',
      '**Next step:** merge PR',
    ].join('\n');
    const result = validateHandoff(handoff);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('returns valid=false and lists missing fields', () => {
    const handoff = '**Goal:** build feature\n**Context:** missing some fields';
    const result = validateHandoff(handoff);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing or empty field: "Requirements"');
    expect(result.errors).toContain('Missing or empty field: "Known problems"');
    expect(result.errors).toContain('Missing or empty field: "Assumptions documented"');
    expect(result.errors).toContain('Missing or empty field: "Success criteria"');
    expect(result.errors).toContain('Missing or empty field: "Next step"');
  });

  it('returns valid=false and errors for a completely empty handoff', () => {
    const result = validateHandoff('');
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(HANDOFF_FIELDS.length);
  });

  it('accepts multi-line field values across line breaks', () => {
    const handoff = [
      '**Goal:** Build something',
      '  that spans multiple',
      '  lines of text',
      '**Context:** in repo root',
      '**Requirements:** must be fast',
      '**Known problems:** none',
      '**Assumptions documented:** agent knows the project',
      '**Success criteria:** tests pass',
      '**Next step:** merge PR',
    ].join('\n');
    const result = validateHandoff(handoff);
    expect(result.valid).toBe(true);
  });

  it('rejects a field with only whitespace and nothing following', () => {
    const handoff = '**Goal:** \n\n';
    const result = validateHandoff(handoff);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => {
        return e.includes('Goal');
      }),
    ).toBe(true);
  });

  it('is case-insensitive for field matching', () => {
    const handoff = [
      '**goal:** build feature',
      '**context:** in repo root',
      '**requirements:** must be fast',
      '**Known problems:** none',
      '**assumptions documented:** pipeline must be installed',
      '**Success criteria:** tests pass',
      '**Next step:** merge PR',
    ].join('\n');
    const result = validateHandoff(handoff);
    expect(result.valid).toBe(true);
  });

  it('returns valid object with correct HandoffValidation shape', () => {
    const result = validateHandoff('incomplete');
    expect(result).toHaveProperty('valid');
    expect(result).toHaveProperty('errors');
    expect(typeof result.valid).toBe('boolean');
    expect(Array.isArray(result.errors)).toBe(true);
    expect(
      result.errors.every((e) => {
        return typeof e === 'string';
      }),
    ).toBe(true);
  });

  it('collects multiple field errors in a single call', () => {
    const handoff = '**Goal:** build feature\n**Context:** in repo root';
    const result = validateHandoff(handoff);
    // Only Goal and Context present; 5 fields missing
    expect(result.errors.length).toBe(5);
  });

  it('handles fields with colon in content correctly', () => {
    const handoff = [
      '**Goal:** fix bug: handle edge case',
      '**Context:** issue #42: null pointer',
      '**Requirements:** must: handle all cases',
      '**Known problems:** none found',
      '**Assumptions documented:** assume: standard env',
      '**Success criteria:** all tests: pass',
      '**Next step:** create: PR',
    ].join('\n');
    const result = validateHandoff(handoff);
    expect(result.valid).toBe(true);
  });

  it('rejects handoff where a field has no content (empty after colon, followed by another field)', () => {
    const handoff = [
      '**Goal:** build feature',
      '**Context:**',
      '**Requirements:** must be fast',
      '**Known problems:** none',
      '**Assumptions documented:** agent knows the project',
      '**Success criteria:** tests pass',
      '**Next step:** merge PR',
    ].join('\n');
    const result = validateHandoff(handoff);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => {
        return e.includes('Context');
      }),
    ).toBe(true);
  });

  it('rejects handoff where a field appears at end of string with no content after colon', () => {
    const handoff = [
      '**Goal:** build feature',
      '**Context:** in repo root',
      '**Requirements:** must be fast',
      '**Known problems:** none',
      '**Assumptions documented:** agent knows the project',
      '**Success criteria:** tests pass',
      '**Next step:** ',
    ].join('\n');
    const result = validateHandoff(handoff);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => {
        return e.includes('Next step');
      }),
    ).toBe(true);
  });
});
