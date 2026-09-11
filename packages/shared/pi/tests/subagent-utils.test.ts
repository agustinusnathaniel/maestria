import { describe, expect, it } from 'vite-plus/test';

import {
  ALLOWED_AGENTS,
  assertNonEmptyTask,
  assertValidAgent,
  MAESTRIA_EVENTS,
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

describe('MAESTRIA_EVENTS', () => {
  it('defines all expected maestria cross-extension events', () => {
    expect(MAESTRIA_EVENTS).toEqual({
      REVIEW_ACTIVATED: 'maestria:review:activated',
      REVIEW_DEACTIVATED: 'maestria:review:deactivated',
      SUBAGENT_COMPLETED: 'maestria:subagent:completed',
      SUBAGENT_FAILED: 'maestria:subagent:failed',
      SUBAGENT_STARTED: 'maestria:subagent:started',
    });
  });

  it('uses the maestria:<domain>:<action> naming convention', () => {
    for (const value of Object.values(MAESTRIA_EVENTS)) {
      expect(value).toMatch(/^maestria:[a-z]+:[a-z]+$/u);
    }
  });
});

// ── assertValidAgent ───────────────────────────────────────────────

describe('assertValidAgent', () => {
  it('passes for every allowed agent', () => {
    for (const agent of ALLOWED_AGENTS) {
      expect(() => {
        assertValidAgent(agent);
      }).not.toThrow();
    }
  });

  it('throws for an unknown agent name', () => {
    expect(() => {
      assertValidAgent('unknown');
    }).toThrow('Unknown agent');
  });

  it('includes the unknown agent name in the error message', () => {
    expect(() => {
      assertValidAgent('bad-agent');
    }).toThrow('bad-agent');
  });

  it('includes the list of allowed agents in the error message', () => {
    expect(() => {
      assertValidAgent('bad-agent');
    }).toThrow(`Allowed: ${ALLOWED_AGENTS.join(', ')}`);
  });

  it('throws for empty string', () => {
    expect(() => {
      assertValidAgent('');
    }).toThrow('Unknown agent');
  });

  it('returns undefined on success', () => {
    assertValidAgent('builder');
  });
});

// ── assertNonEmptyTask ─────────────────────────────────────────────

describe('assertNonEmptyTask', () => {
  it('passes for a non-empty task string', () => {
    expect(() => {
      assertNonEmptyTask('do something', 'Task is required');
    }).not.toThrow();
  });

  it('passes for a task with leading/trailing whitespace but content', () => {
    expect(() => {
      assertNonEmptyTask('  valid task  ', 'Task is required');
    }).not.toThrow();
  });

  it('throws for undefined task', () => {
    expect(() => {
      assertNonEmptyTask(undefined, 'Task is required');
    }).toThrow('Task is required');
  });

  it('throws for empty string', () => {
    expect(() => {
      assertNonEmptyTask('', 'Task is required');
    }).toThrow('Task is required');
  });

  it('throws for whitespace-only string', () => {
    expect(() => {
      assertNonEmptyTask('   ', 'Task description must not be blank');
    }).toThrow('Task description must not be blank');
  });

  it('uses the provided label in the error message', () => {
    expect(() => {
      assertNonEmptyTask('', 'Custom error label');
    }).toThrow('Custom error label');
  });
});
