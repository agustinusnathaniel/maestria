import { describe, expect, it } from 'vite-plus/test';

import {
  ALLOWED_AGENTS,
  assertNonEmptyTask,
  assertValidAgent,
  MAESTRIA_EVENTS,
} from '../src/subagent-utils.js';
import type { AllowedAgent } from '../src/subagent-utils.js';

const assertAgent: (agent: string) => asserts agent is AllowedAgent = assertValidAgent;
const assertTask: (task: string | undefined, label: string) => asserts task is string =
  assertNonEmptyTask;

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
        assertAgent(agent);
      }).not.toThrow();
    }
  });

  it('throws for an unknown agent name', () => {
    expect(() => {
      assertAgent('unknown');
    }).toThrow('Unknown agent');
  });

  it('includes the unknown agent name in the error message', () => {
    expect(() => {
      assertAgent('bad-agent');
    }).toThrow('bad-agent');
  });

  it('includes the list of allowed agents in the error message', () => {
    expect(() => {
      assertAgent('bad-agent');
    }).toThrow(`Allowed: ${ALLOWED_AGENTS.join(', ')}`);
  });

  it('throws for empty string', () => {
    expect(() => {
      assertAgent('');
    }).toThrow('Unknown agent');
  });

  it('returns undefined on success', () => {
    assertAgent('builder');
  });
});

// ── assertNonEmptyTask ─────────────────────────────────────────────

describe('assertNonEmptyTask', () => {
  it('passes for a non-empty task string', () => {
    expect(() => {
      assertTask('do something', 'Task is required');
    }).not.toThrow();
  });

  it('passes for a task with leading/trailing whitespace but content', () => {
    expect(() => {
      assertTask('  valid task  ', 'Task is required');
    }).not.toThrow();
  });

  it('throws for undefined task', () => {
    expect(() => {
      assertTask(undefined, 'Task is required');
    }).toThrow('Task is required');
  });

  it('throws for empty string', () => {
    expect(() => {
      assertTask('', 'Task is required');
    }).toThrow('Task is required');
  });

  it('throws for whitespace-only string', () => {
    expect(() => {
      assertTask('   ', 'Task description must not be blank');
    }).toThrow('Task description must not be blank');
  });

  it('uses the provided label in the error message', () => {
    expect(() => {
      assertTask('', 'Custom error label');
    }).toThrow('Custom error label');
  });
});
