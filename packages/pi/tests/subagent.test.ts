import { describe, it, expect, vi } from 'vite-plus/test';
import {
  validateHandoff,
  installSubagentTool,
  MAX_PARALLEL_TASKS,
  MAESTRIA_EVENTS,
} from '../src/subagent.js';
import { createInitialState } from '../src/state.js';
import { SUBAGENT_EVENTS } from '@gotgenes/pi-subagents';

describe('MAX_PARALLEL_TASKS', () => {
  it('is exported as 8', () => {
    expect(MAX_PARALLEL_TASKS).toBe(8);
  });
});

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

describe('installSubagentTool - single mode (backward compat)', () => {
  it('registers a tool named "maestria_subagent"', () => {
    const pi = { registerTool: vi.fn() };
    const state = createInitialState();
    installSubagentTool(pi as any, state);
    const toolDef = (pi as any).registerTool.mock.calls[0][0];
    expect(toolDef.name).toBe('maestria_subagent');
  });

  it('rejects unknown agent names', async () => {
    const pi = { registerTool: vi.fn() };
    const state = createInitialState();
    installSubagentTool(pi as any, state);

    const toolDef = (pi as any).registerTool.mock.calls[0][0];
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
    const pi = { registerTool: vi.fn() };
    const state = createInitialState();
    installSubagentTool(pi as any, state);

    const toolDef = (pi as any).registerTool.mock.calls[0][0];
    await expect(
      toolDef.execute('call-1', { agent: 'builder', task: '' }, undefined, undefined, {}),
    ).rejects.toThrow('Task description is required');
  });

  it('falls back to handoff text when SDK is unavailable', async () => {
    const pi = { registerTool: vi.fn(), appendEntry: vi.fn() };
    const state = createInitialState();
    installSubagentTool(pi as any, state);

    const toolDef = (pi as any).registerTool.mock.calls[0][0];
    const result = await toolDef.execute(
      'call-1',
      { agent: 'builder', task: 'do something' },
      undefined,
      undefined,
      {},
    );
    expect(result.content[0].text).toContain('## Subagent Handoff Required');
  });

  it('works with explicit mode=single', async () => {
    const pi = { registerTool: vi.fn(), appendEntry: vi.fn() };
    const state = createInitialState();
    installSubagentTool(pi as any, state);

    const toolDef = (pi as any).registerTool.mock.calls[0][0];
    const result = await toolDef.execute(
      'call-1',
      { mode: 'single', agent: 'builder', task: 'do something' },
      undefined,
      undefined,
      {},
    );
    expect(result.content[0].text).toContain('## Subagent Handoff Required');
  });
});

describe('installSubagentTool - parallel mode', () => {
  it('throws for 1 task (below minimum of 2)', async () => {
    const pi = { registerTool: vi.fn() };
    const state = createInitialState();
    installSubagentTool(pi as any, state);

    const toolDef = (pi as any).registerTool.mock.calls[0][0];
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

  it('throws for more than 8 tasks', async () => {
    const pi = { registerTool: vi.fn() };
    const state = createInitialState();
    installSubagentTool(pi as any, state);

    const toolDef = (pi as any).registerTool.mock.calls[0][0];
    const tasks = Array.from({ length: 9 }, (_, i) => ({
      agent: 'builder' as const,
      task: `task ${i + 1}`,
    }));
    await expect(
      toolDef.execute('call-1', { mode: 'parallel', tasks }, undefined, undefined, {}),
    ).rejects.toThrow('at most 8');
  });

  it('throws for unknown agent in tasks', async () => {
    const pi = { registerTool: vi.fn() };
    const state = createInitialState();
    installSubagentTool(pi as any, state);

    const toolDef = (pi as any).registerTool.mock.calls[0][0];
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
    const pi = { registerTool: vi.fn() };
    const state = createInitialState();
    installSubagentTool(pi as any, state);

    const toolDef = (pi as any).registerTool.mock.calls[0][0];
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

  it('falls back to handoff text when SDK is unavailable (valid parallel)', async () => {
    const pi = { registerTool: vi.fn(), appendEntry: vi.fn() };
    const state = createInitialState();
    installSubagentTool(pi as any, state);

    const toolDef = (pi as any).registerTool.mock.calls[0][0];
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
    expect(result.content[0].text).toContain('## Subagent Handoff Required');
  });
});

describe('installSubagentTool - chain mode', () => {
  it('throws for 1 task (below minimum of 2)', async () => {
    const pi = { registerTool: vi.fn() };
    const state = createInitialState();
    installSubagentTool(pi as any, state);

    const toolDef = (pi as any).registerTool.mock.calls[0][0];
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
    const pi = { registerTool: vi.fn() };
    const state = createInitialState();
    installSubagentTool(pi as any, state);

    const toolDef = (pi as any).registerTool.mock.calls[0][0];
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

  it('falls back to handoff text when SDK is unavailable (valid chain)', async () => {
    const pi = { registerTool: vi.fn(), appendEntry: vi.fn() };
    const state = createInitialState();
    installSubagentTool(pi as any, state);

    const toolDef = (pi as any).registerTool.mock.calls[0][0];
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
    expect(result.content[0].text).toContain('## Subagent Handoff Required');
  });
});

describe('installSubagentTool - event subscription persistence', () => {
  function createMockEventBus() {
    const handlers: Record<string, Array<(data: unknown) => void>> = {};
    return {
      on: vi.fn((event: string, handler: (data: unknown) => void) => {
        if (!handlers[event]) handlers[event] = [];
        handlers[event].push(handler);
        return () => {}; // unsub
      }),
      emit: vi.fn(),
      _emit: (event: string, data: unknown) => {
        handlers[event]?.forEach((h) => h(data));
      },
      _handlers: handlers,
    };
  }

  it('persists state on STARTED event', () => {
    const events = createMockEventBus();
    const pi = { registerTool: vi.fn(), appendEntry: vi.fn(), events };
    const state = createInitialState();
    installSubagentTool(pi as any, state);

    events._emit(SUBAGENT_EVENTS.STARTED, { id: 'agent-1', type: 'builder' });

    expect(state.subagentStatus['agent-1']).toBeDefined();
    expect(state.subagentStatus['agent-1'].status).toBe('running');
    expect(pi.appendEntry).toHaveBeenCalledWith(
      'maestria_state',
      expect.objectContaining({
        subagentStatus: expect.objectContaining({
          'agent-1': expect.objectContaining({ status: 'running' }),
        }),
      }),
    );
  });

  it('persists state on COMPLETED event', () => {
    const events = createMockEventBus();
    const pi = { registerTool: vi.fn(), appendEntry: vi.fn(), events };
    const state = createInitialState();
    state.subagentStatus['agent-1'] = {
      type: 'builder',
      status: 'running',
      startedAt: Date.now(),
    };
    installSubagentTool(pi as any, state);

    events._emit(SUBAGENT_EVENTS.COMPLETED, { id: 'agent-1' });

    expect(state.subagentStatus['agent-1'].status).toBe('completed');
    expect(pi.appendEntry).toHaveBeenCalledWith(
      'maestria_state',
      expect.objectContaining({
        subagentStatus: expect.objectContaining({
          'agent-1': expect.objectContaining({ status: 'completed' }),
        }),
      }),
    );
  });

  it('persists state on FAILED event', () => {
    const events = createMockEventBus();
    const pi = { registerTool: vi.fn(), appendEntry: vi.fn(), events };
    const state = createInitialState();
    state.subagentStatus['agent-1'] = {
      type: 'builder',
      status: 'running',
      startedAt: Date.now(),
    };
    installSubagentTool(pi as any, state);

    events._emit(SUBAGENT_EVENTS.FAILED, { id: 'agent-1', status: 'error' });

    expect(state.subagentStatus['agent-1'].status).toBe('error');
    expect(pi.appendEntry).toHaveBeenCalledWith(
      'maestria_state',
      expect.objectContaining({
        subagentStatus: expect.objectContaining({
          'agent-1': expect.objectContaining({ status: 'error' }),
        }),
      }),
    );
  });

  it('persists state on STEERED event when agent is new', () => {
    const events = createMockEventBus();
    const pi = { registerTool: vi.fn(), appendEntry: vi.fn(), events };
    const state = createInitialState();
    installSubagentTool(pi as any, state);

    events._emit(SUBAGENT_EVENTS.STEERED, { id: 'agent-new' });

    expect(state.subagentStatus['agent-new']).toBeDefined();
    expect(state.subagentStatus['agent-new'].status).toBe('running');
    expect(pi.appendEntry).toHaveBeenCalledWith(
      'maestria_state',
      expect.objectContaining({
        subagentStatus: expect.objectContaining({
          'agent-new': expect.objectContaining({ status: 'running' }),
        }),
      }),
    );
  });

  it('persists state on STEERED event when agent already exists', () => {
    const events = createMockEventBus();
    const pi = { registerTool: vi.fn(), appendEntry: vi.fn(), events };
    const state = createInitialState();
    state.subagentStatus['existing-agent'] = {
      type: 'architect',
      status: 'running',
      startedAt: Date.now(),
    };
    installSubagentTool(pi as any, state);

    events._emit(SUBAGENT_EVENTS.STEERED, { id: 'existing-agent' });

    // Existing agent should remain untouched
    expect(state.subagentStatus['existing-agent'].status).toBe('running');
    // State should be persisted regardless
    expect(pi.appendEntry).toHaveBeenCalledWith('maestria_state', expect.any(Object));
  });

  it('emits maestria:subagent:started on STARTED event', () => {
    const events = createMockEventBus();
    const pi = { registerTool: vi.fn(), appendEntry: vi.fn(), events };
    const state = createInitialState();
    installSubagentTool(pi as any, state);

    events._emit(SUBAGENT_EVENTS.STARTED, { id: 'agent-1', type: 'builder' });

    expect(events.emit).toHaveBeenCalledWith(
      MAESTRIA_EVENTS.SUBAGENT_STARTED,
      expect.objectContaining({
        id: 'agent-1',
        type: 'builder',
        timestamp: expect.any(Number),
      }),
    );
  });

  it('emits maestria:subagent:completed on COMPLETED event', () => {
    const events = createMockEventBus();
    const pi = { registerTool: vi.fn(), appendEntry: vi.fn(), events };
    const state = createInitialState();
    state.subagentStatus['agent-1'] = {
      type: 'builder',
      status: 'running',
      startedAt: Date.now(),
    };
    installSubagentTool(pi as any, state);

    events._emit(SUBAGENT_EVENTS.COMPLETED, { id: 'agent-1' });

    expect(events.emit).toHaveBeenCalledWith(
      MAESTRIA_EVENTS.SUBAGENT_COMPLETED,
      expect.objectContaining({
        id: 'agent-1',
        type: 'builder',
        timestamp: expect.any(Number),
      }),
    );
  });

  it('emits maestria:subagent:failed on FAILED event', () => {
    const events = createMockEventBus();
    const pi = { registerTool: vi.fn(), appendEntry: vi.fn(), events };
    const state = createInitialState();
    state.subagentStatus['agent-1'] = {
      type: 'builder',
      status: 'running',
      startedAt: Date.now(),
    };
    installSubagentTool(pi as any, state);

    events._emit(SUBAGENT_EVENTS.FAILED, { id: 'agent-1', status: 'error' });

    expect(events.emit).toHaveBeenCalledWith(
      MAESTRIA_EVENTS.SUBAGENT_FAILED,
      expect.objectContaining({
        id: 'agent-1',
        type: 'builder',
        timestamp: expect.any(Number),
      }),
    );
  });
});

describe('installSubagentTool - validation errors without tasks', () => {
  it('throws for mode=parallel without tasks', async () => {
    const pi = { registerTool: vi.fn() };
    const state = createInitialState();
    installSubagentTool(pi as any, state);

    const toolDef = (pi as any).registerTool.mock.calls[0][0];
    await expect(
      toolDef.execute('call-1', { mode: 'parallel' }, undefined, undefined, {}),
    ).rejects.toThrow('tasks array is required');
  });

  it('throws for mode=chain without tasks', async () => {
    const pi = { registerTool: vi.fn() };
    const state = createInitialState();
    installSubagentTool(pi as any, state);

    const toolDef = (pi as any).registerTool.mock.calls[0][0];
    await expect(
      toolDef.execute('call-1', { mode: 'chain' }, undefined, undefined, {}),
    ).rejects.toThrow('tasks array is required');
  });
});
