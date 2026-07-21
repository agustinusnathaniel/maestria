import { describe, it, expect, vi } from 'vite-plus/test';
import { validateHandoff, installSubagentTool, MAESTRIA_EVENTS } from '@/subagent.js';
import { createInitialState } from '@/state.js';

describe('validateHandoff', () => {
  it('returns valid for a handoff with all 6 fields', () => {
    const handoff = [
      '**Goal:** build feature',
      '**Context:** in repo root',
      '**Requirements:** must be fast',
      '**Known problems:** none',
      '**Success criteria:** tests pass',
      '**Next step:** merge PR',
    ].join('\n');
    expect(validateHandoff(handoff).valid).toBe(true);
  });

  it('returns errors when a field is missing', () => {
    const handoff = '**Goal:** build feature\n**Context:** missing some fields';
    const result = validateHandoff(handoff);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('accepts multi-line field values across line breaks', () => {
    const handoff = [
      '**Goal:** Build something',
      '  that spans multiple',
      '  lines of text',
      '**Context:** in repo root',
      '**Requirements:** must be fast',
      '**Known problems:** none',
      '**Success criteria:** tests pass',
      '**Next step:** merge PR',
    ].join('\n');
    const result = validateHandoff(handoff);
    expect(result.valid).toBe(true);
  });

  it('returns errors when a field has no content (only whitespace, nothing follows)', () => {
    const handoff = '**Goal:** \n\n';
    const result = validateHandoff(handoff);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Goal'))).toBe(true);
  });
});

const zodChainable = () => ({
  describe: vi.fn(zodChainable),
  optional: vi.fn(() => ({})),
});

function createMockPi() {
  return {
    registerTool: vi.fn(),
    appendEntry: vi.fn(),
    zod: {
      object: vi.fn(() => ({})),
      string: vi.fn(zodChainable),
      array: vi.fn(zodChainable),
      enum: vi.fn(zodChainable),
    },
  };
}

function getToolDef(pi: any): any {
  return pi.registerTool.mock.calls[0][0];
}

describe('installSubagentTool - tool registration', () => {
  it('registers a tool named "maestria_subagent"', () => {
    const pi = createMockPi();
    const state = createInitialState();
    installSubagentTool(pi as any, state);
    const toolDef = getToolDef(pi);
    expect(toolDef.name).toBe('maestria_subagent');
  });

  it('registers the tool with label and description', () => {
    const pi = createMockPi();
    const state = createInitialState();
    installSubagentTool(pi as any, state);
    const toolDef = getToolDef(pi);
    expect(toolDef.label).toBe('Maestria Subagent');
    expect(toolDef.description).toContain('Dispatch a task to a maestria specialist subagent');
  });

  it('defines parameters using pi.zod', () => {
    const pi = createMockPi();
    const state = createInitialState();
    installSubagentTool(pi as any, state);
    expect(pi.zod.object).toHaveBeenCalled();
    expect(pi.zod.string).toHaveBeenCalled();
    expect(pi.zod.array).toHaveBeenCalled();
  });
});

describe('installSubagentTool - single mode', () => {
  it('rejects unknown agent names', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    installSubagentTool(pi as any, state);

    const toolDef = getToolDef(pi);
    await expect(
      toolDef.execute(
        'call-1',
        { agent: 'unknown', task: 'do something' },
        undefined,
        undefined,
        {},
      ),
    ).rejects.toThrow('Unknown agent');
  });

  it('rejects empty task description', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    installSubagentTool(pi as any, state);

    const toolDef = getToolDef(pi);
    await expect(
      toolDef.execute('call-1', { agent: 'builder', task: '' }, undefined, undefined, {}),
    ).rejects.toThrow('Task description is required');
  });

  it('returns delegation prompt for valid single mode', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    installSubagentTool(pi as any, state);

    const toolDef = getToolDef(pi);
    const result = await toolDef.execute(
      'call-1',
      { agent: 'builder', task: 'build the feature' },
      undefined,
      undefined,
      {},
    );
    expect(result.content[0].text).toContain('## Delegation: builder');
    expect(result.content[0].text).toContain('task(agent: "builder"');
    expect(result.content[0].text).toContain('build the feature');
  });
});

describe('installSubagentTool - parallel mode', () => {
  it('throws for 1 task (below minimum of 2)', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    installSubagentTool(pi as any, state);

    const toolDef = getToolDef(pi);
    await expect(
      toolDef.execute(
        'call-1',
        {
          mode: 'parallel',
          tasks: [{ agent: 'builder', task: 'build' }],
        },
        undefined,
        undefined,
        {},
      ),
    ).rejects.toThrow('at least 2 items');
  });

  it('throws for unknown agent in tasks', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    installSubagentTool(pi as any, state);

    const toolDef = getToolDef(pi);
    await expect(
      toolDef.execute(
        'call-1',
        {
          mode: 'parallel',
          tasks: [
            { agent: 'builder', task: 'build' },
            { agent: 'unknown', task: 'something' },
          ],
        },
        undefined,
        undefined,
        {},
      ),
    ).rejects.toThrow('Unknown agent');
  });

  it('throws when a task has empty description', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    installSubagentTool(pi as any, state);

    const toolDef = getToolDef(pi);
    await expect(
      toolDef.execute(
        'call-1',
        {
          mode: 'parallel',
          tasks: [
            { agent: 'builder', task: 'build' },
            { agent: 'architect', task: '' },
          ],
        },
        undefined,
        undefined,
        {},
      ),
    ).rejects.toThrow('Task description is required');
  });

  it('returns dispatch plan for valid parallel mode', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    installSubagentTool(pi as any, state);

    const toolDef = getToolDef(pi);
    const result = await toolDef.execute(
      'call-1',
      {
        mode: 'parallel',
        tasks: [
          { agent: 'builder', task: 'build' },
          { agent: 'architect', task: 'design' },
        ],
      },
      undefined,
      undefined,
      {},
    );
    expect(result.content[0].text).toContain('## Parallel Dispatch Plan');
    expect(result.content[0].text).toContain('builder');
    expect(result.content[0].text).toContain('architect');
    expect(result.content[0].text).toContain('task(agent: "builder"');
    expect(result.content[0].text).toContain('task(agent: "architect"');
  });
});

describe('installSubagentTool - chain mode', () => {
  it('throws for 1 task (below minimum of 2)', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    installSubagentTool(pi as any, state);

    const toolDef = getToolDef(pi);
    await expect(
      toolDef.execute(
        'call-1',
        {
          mode: 'chain',
          tasks: [{ agent: 'builder', task: 'build' }],
        },
        undefined,
        undefined,
        {},
      ),
    ).rejects.toThrow('at least 2 items');
  });

  it('throws for unknown agent in tasks', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    installSubagentTool(pi as any, state);

    const toolDef = getToolDef(pi);
    await expect(
      toolDef.execute(
        'call-1',
        {
          mode: 'chain',
          tasks: [
            { agent: 'builder', task: 'build' },
            { agent: 'bogus', task: 'something' },
          ],
        },
        undefined,
        undefined,
        {},
      ),
    ).rejects.toThrow('Unknown agent');
  });

  it('returns dispatch plan for valid chain mode', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    installSubagentTool(pi as any, state);

    const toolDef = getToolDef(pi);
    const result = await toolDef.execute(
      'call-1',
      {
        mode: 'chain',
        tasks: [
          { agent: 'builder', task: 'build' },
          { agent: 'reviewer', task: 'review the result' },
        ],
      },
      undefined,
      undefined,
      {},
    );
    expect(result.content[0].text).toContain('## Chain Dispatch Plan');
    expect(result.content[0].text).toContain('builder');
    expect(result.content[0].text).toContain('reviewer');
    expect(result.content[0].text).toContain('{previous}');
  });
});

describe('installSubagentTool - review mode blocks', () => {
  it('blocks dispatch during review mode', async () => {
    const pi = createMockPi();
    const state = { ...createInitialState(), reviewMode: true };
    installSubagentTool(pi as any, state);

    const toolDef = getToolDef(pi);
    const result = await toolDef.execute(
      'call-1',
      { agent: 'builder', task: 'build something' },
      undefined,
      undefined,
      {},
    );
    expect(result.content[0].text).toContain('not available during review mode');
    expect(result.content[0].text).toContain('/restore-model');
  });
});

describe('installSubagentTool - validation errors', () => {
  it('throws for mode=parallel without tasks', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    installSubagentTool(pi as any, state);

    const toolDef = getToolDef(pi);
    await expect(
      toolDef.execute('call-1', { mode: 'parallel' }, undefined, undefined, {}),
    ).rejects.toThrow('tasks array is required');
  });

  it('throws for mode=chain without tasks', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    installSubagentTool(pi as any, state);

    const toolDef = getToolDef(pi);
    await expect(
      toolDef.execute('call-1', { mode: 'chain' }, undefined, undefined, {}),
    ).rejects.toThrow('tasks array is required');
  });
});

describe('installSubagentTool - handoff recording', () => {
  it('records handoff in state for single mode', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    installSubagentTool(pi as any, state);

    const toolDef = getToolDef(pi);
    await toolDef.execute(
      'call-1',
      { agent: 'builder', task: 'build the feature' },
      undefined,
      undefined,
      {},
    );

    expect(state.handoffHistory).toHaveLength(1);
    expect(state.handoffHistory[0].from).toBe('orchestrator');
    expect(state.handoffHistory[0].to).toBe('builder');
    expect(state.handoffHistory[0].task).toBe('build the feature');
  });

  it('records handoffs in state for parallel mode', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    installSubagentTool(pi as any, state);

    const toolDef = getToolDef(pi);
    await toolDef.execute(
      'call-1',
      {
        mode: 'parallel',
        tasks: [
          { agent: 'builder', task: 'build' },
          { agent: 'architect', task: 'design' },
        ],
      },
      undefined,
      undefined,
      {},
    );

    expect(state.handoffHistory).toHaveLength(2);
    expect(state.handoffHistory[0].to).toBe('architect');
    expect(state.handoffHistory[0].task).toBe('design');
    expect(state.handoffHistory[1].to).toBe('builder');
    expect(state.handoffHistory[1].task).toBe('build');
  });

  it('persists state via appendEntry after handoff recording', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    installSubagentTool(pi as any, state);

    const toolDef = getToolDef(pi);
    await toolDef.execute('call-1', { agent: 'builder', task: 'build' }, undefined, undefined, {});

    expect(pi.appendEntry).toHaveBeenCalledWith(
      'maestria_state',
      expect.objectContaining({
        handoffHistory: expect.arrayContaining([expect.objectContaining({ task: 'build' })]),
      }),
    );
  });
});

describe('MAESTRIA_EVENTS', () => {
  it('exports expected event names', () => {
    expect(MAESTRIA_EVENTS.REVIEW_ACTIVATED).toBe('maestria:review:activated');
    expect(MAESTRIA_EVENTS.REVIEW_DEACTIVATED).toBe('maestria:review:deactivated');
    expect(MAESTRIA_EVENTS.SUBAGENT_STARTED).toBe('maestria:subagent:started');
    expect(MAESTRIA_EVENTS.SUBAGENT_COMPLETED).toBe('maestria:subagent:completed');
    expect(MAESTRIA_EVENTS.SUBAGENT_FAILED).toBe('maestria:subagent:failed');
  });
});
