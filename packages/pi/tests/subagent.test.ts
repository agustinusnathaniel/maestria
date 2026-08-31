import { SUBAGENT_EVENTS } from '@gotgenes/pi-subagents';
import { MAESTRIA_EVENTS, validateHandoff } from '@maestria/shared-pi/subagent-utils';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { createInitialState } from '@/state.js';
import { installSubagentTool, MAX_PARALLEL_TASKS } from '@/subagent.js';

// Mock the subagents SDK so execute() can reach recordAndPersist (existing tests
// keep the SDK-unavailable fallback by leaving getSubagentsServiceMock undefined).
const subagentsServiceMock = vi.hoisted(() => ({
  abort: vi.fn(),
  getRecord: vi.fn(),
  spawn: vi.fn(),
}));
const getSubagentsServiceMock = vi.hoisted(() => vi.fn());

vi.mock('@gotgenes/pi-subagents', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@gotgenes/pi-subagents')>();
  return {
    ...actual,
    getSubagentsService: getSubagentsServiceMock,
  };
});

// Suppress expected console.warn noise from SDK-unavailable fallback paths
vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('MAX_PARALLEL_TASKS', () => {
  it('is exported as 8', () => {
    expect(MAX_PARALLEL_TASKS).toBe(8);
  });
});

describe('validateHandoff', () => {
  it('returns valid for a handoff with all 7 fields', () => {
    const handoff = [
      '**Goal:** build feature',
      '**Context:** in repo root',
      '**Requirements:** must be fast',
      '**Known problems:** none',
      '**Assumptions documented:** pipeline must be installed',
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
      '**Assumptions documented:** agent knows the project',
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

  it('returns an actionable message for unknown agent names', async () => {
    const pi = { registerTool: vi.fn() };
    const state = createInitialState();
    installSubagentTool(pi as any, state);

    const toolDef = (pi as any).registerTool.mock.calls[0][0];
    const result = await toolDef.execute(
      'call-1',
      { agent: 'unknown', task: 'do something' },
      undefined,
      undefined,
      {},
    );
    const { text } = result.content[0];
    expect(text).toContain('Invalid maestria_subagent call');
    expect(text).toContain('agent');
    expect(text).toContain('adventurer');
  });

  it('returns an actionable message when agent is missing', async () => {
    const pi = { registerTool: vi.fn() };
    const state = createInitialState();
    installSubagentTool(pi as any, state);

    const toolDef = (pi as any).registerTool.mock.calls[0][0];
    const result = await toolDef.execute(
      'call-1',
      { task: 'do something' },
      undefined,
      undefined,
      {},
    );
    const { text } = result.content[0];
    expect(text).toContain('Invalid maestria_subagent call');
    expect(text).toContain('agent');
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
    const pi = { appendEntry: vi.fn(), registerTool: vi.fn() };
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
    expect(result.content[0].text).toContain('## Subagent Dispatch Unavailable');
  });

  it('works with explicit mode=single', async () => {
    const pi = { appendEntry: vi.fn(), registerTool: vi.fn() };
    const state = createInitialState();
    installSubagentTool(pi as any, state);

    const toolDef = (pi as any).registerTool.mock.calls[0][0];
    const result = await toolDef.execute(
      'call-1',
      { agent: 'builder', mode: 'single', task: 'do something' },
      undefined,
      undefined,
      {},
    );
    expect(result.content[0].text).toContain('## Subagent Dispatch Unavailable');
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
    const pi = { appendEntry: vi.fn(), registerTool: vi.fn() };
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
    expect(result.content[0].text).toContain('## Subagent Dispatch Unavailable');
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
    const pi = { appendEntry: vi.fn(), registerTool: vi.fn() };
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
    expect(result.content[0].text).toContain('## Subagent Dispatch Unavailable');
  });
});

describe('installSubagentTool - event subscription persistence', () => {
  function createMockEventBus() {
    const handlers: Record<string, ((data: unknown) => void)[]> = {};
    return {
      _emit: (event: string, data: unknown) => {
        handlers[event]?.forEach((h) => {
          h(data);
        });
      },
      _handlers: handlers,
      emit: vi.fn(),
      on: vi.fn((event: string, handler: (data: unknown) => void) => {
        if (!handlers[event]) {
          handlers[event] = [];
        }
        handlers[event].push(handler);
        return () => {}; // unsub
      }),
    };
  }

  it('persists state on STARTED event', () => {
    const events = createMockEventBus();
    const pi = { appendEntry: vi.fn(), events, registerTool: vi.fn() };
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
    const pi = { appendEntry: vi.fn(), events, registerTool: vi.fn() };
    const state = createInitialState();
    state.subagentStatus['agent-1'] = {
      startedAt: Date.now(),
      status: 'running',
      type: 'builder',
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
    const pi = { appendEntry: vi.fn(), events, registerTool: vi.fn() };
    const state = createInitialState();
    state.subagentStatus['agent-1'] = {
      startedAt: Date.now(),
      status: 'running',
      type: 'builder',
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
    const pi = { appendEntry: vi.fn(), events, registerTool: vi.fn() };
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
    const pi = { appendEntry: vi.fn(), events, registerTool: vi.fn() };
    const state = createInitialState();
    state.subagentStatus['existing-agent'] = {
      startedAt: Date.now(),
      status: 'running',
      type: 'architect',
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
    const pi = { appendEntry: vi.fn(), events, registerTool: vi.fn() };
    const state = createInitialState();
    installSubagentTool(pi as any, state);

    events._emit(SUBAGENT_EVENTS.STARTED, { id: 'agent-1', type: 'builder' });

    expect(events.emit).toHaveBeenCalledWith(
      MAESTRIA_EVENTS.SUBAGENT_STARTED,
      expect.objectContaining({
        id: 'agent-1',
        timestamp: expect.any(Number),
        type: 'builder',
      }),
    );
  });

  it('emits maestria:subagent:completed on COMPLETED event', () => {
    const events = createMockEventBus();
    const pi = { appendEntry: vi.fn(), events, registerTool: vi.fn() };
    const state = createInitialState();
    state.subagentStatus['agent-1'] = {
      startedAt: Date.now(),
      status: 'running',
      type: 'builder',
    };
    installSubagentTool(pi as any, state);

    events._emit(SUBAGENT_EVENTS.COMPLETED, { id: 'agent-1' });

    expect(events.emit).toHaveBeenCalledWith(
      MAESTRIA_EVENTS.SUBAGENT_COMPLETED,
      expect.objectContaining({
        id: 'agent-1',
        timestamp: expect.any(Number),
        type: 'builder',
      }),
    );
  });

  it('emits maestria:subagent:failed on FAILED event', () => {
    const events = createMockEventBus();
    const pi = { appendEntry: vi.fn(), events, registerTool: vi.fn() };
    const state = createInitialState();
    state.subagentStatus['agent-1'] = {
      startedAt: Date.now(),
      status: 'running',
      type: 'builder',
    };
    installSubagentTool(pi as any, state);

    events._emit(SUBAGENT_EVENTS.FAILED, { id: 'agent-1', status: 'error' });

    expect(events.emit).toHaveBeenCalledWith(
      MAESTRIA_EVENTS.SUBAGENT_FAILED,
      expect.objectContaining({
        id: 'agent-1',
        timestamp: expect.any(Number),
        type: 'builder',
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

describe('installSubagentTool - handoff recording', () => {
  beforeEach(() => {
    getSubagentsServiceMock.mockReturnValue(subagentsServiceMock);
    subagentsServiceMock.spawn.mockReturnValue('agent-1');
    subagentsServiceMock.getRecord.mockReturnValue({ result: 'done', status: 'completed' });
  });

  it('records specialist in state for single mode', async () => {
    const pi = { appendEntry: vi.fn(), registerTool: vi.fn() };
    const state = createInitialState();
    installSubagentTool(pi as any, state);

    const toolDef = (pi as any).registerTool.mock.calls[0][0];
    await toolDef.execute(
      'call-1',
      { agent: 'builder', task: 'build the feature' },
      undefined,
      undefined,
      {},
    );

    expect(state.handoffHistory).toHaveLength(1);
    expect(state.handoffHistory[0].to).toBe('builder');
    expect(state.specialistsDelegated).toEqual(['builder']);
    expect(pi.appendEntry).toHaveBeenCalledWith(
      'maestria_state',
      expect.objectContaining({ specialistsDelegated: ['builder'] }),
    );
  });

  it('deduplicates specialists across repeated delegation', async () => {
    const pi = { appendEntry: vi.fn(), registerTool: vi.fn() };
    const state = createInitialState();
    installSubagentTool(pi as any, state);

    const toolDef = (pi as any).registerTool.mock.calls[0][0];
    await toolDef.execute('call-1', { agent: 'builder', task: 'build' }, undefined, undefined, {});
    await toolDef.execute(
      'call-2',
      { agent: 'builder', task: 'build again' },
      undefined,
      undefined,
      {},
    );

    expect(state.specialistsDelegated).toEqual(['builder']);
  });
});

describe('installSubagentTool - parallel partial failure', () => {
  function install() {
    const pi = { appendEntry: vi.fn(), registerTool: vi.fn() };
    const state = createInitialState();
    installSubagentTool(pi as any, state);
    const toolDef = (pi as any).registerTool.mock.calls[0][0];
    return { pi, state, toolDef };
  }

  it('preserves completed results when one subagent is cleaned up (poll throws)', async () => {
    getSubagentsServiceMock.mockReturnValue(subagentsServiceMock);
    subagentsServiceMock.spawn.mockImplementation((agent: string) =>
      agent === 'builder' ? 'id-a' : 'id-b',
    );
    // id-a completes with a result; id-b's record disappears -> poll throws
    // "cleaned up before completion" -> the failed outcome must not discard
    // id-a's completed result.
    subagentsServiceMock.getRecord.mockImplementation((id: string) => {
      if (id === 'id-a') {
        return { result: 'RESULT_A_OK', status: 'completed' };
      }
      return; // id-b cleaned up
    });

    const { toolDef } = install();

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
    const { text } = result.content[0];
    expect(text).toContain('RESULT_A_OK');
    expect(text).not.toContain('Subagent Handoff Required');
  });

  it('aborts still-running sibling subagents when one fails instead of orphaning them', async () => {
    getSubagentsServiceMock.mockReturnValue(subagentsServiceMock);
    subagentsServiceMock.spawn.mockImplementation((agent: string) =>
      agent === 'builder' ? 'id-a' : 'id-b',
    );
    // id-a keeps running (never terminal) until aborted; id-b cleaned up ->
    // poll throws -> the sibling abort must stop id-a and it must be called.
    const aborted = new Set<string>();
    subagentsServiceMock.abort.mockImplementation((id: string) => {
      aborted.add(id);
      return true;
    });
    subagentsServiceMock.getRecord.mockImplementation((id: string) => {
      if (aborted.has(id)) {
        return { status: 'aborted' };
      }
      if (id === 'id-a') {
        return { status: 'running' };
      }
      return; // id-b cleaned up
    });

    const { toolDef } = install();

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
    expect(subagentsServiceMock.abort).toHaveBeenCalledWith('id-a');
  });

  it('aborts and returns an error marker when a chain step record is cleaned up', async () => {
    getSubagentsServiceMock.mockReturnValue(subagentsServiceMock);
    subagentsServiceMock.spawn.mockImplementation((agent: string) =>
      agent === 'builder' ? 'id-a' : 'id-b',
    );
    // id-a completes; id-b's record disappears -> poll throws -> the step
    // must be aborted and the chain must surface an error marker.
    subagentsServiceMock.getRecord.mockImplementation((id: string) => {
      if (id === 'id-a') {
        return { result: 'STEP_A_OK', status: 'completed' };
      }
      return; // id-b cleaned up
    });

    const { toolDef } = install();

    const result = await toolDef.execute(
      'call-1',
      {
        mode: 'chain',
        tasks: [
          { agent: 'builder', task: 'build' },
          { agent: 'architect', task: 'design' },
        ],
      },
      undefined,
      undefined,
      {},
    );
    const { text } = result.content[0];
    expect(text).toContain('[error]');
    expect(text).not.toContain('Subagent Handoff Required');
    expect(subagentsServiceMock.abort).toHaveBeenCalledWith('id-b');
  });

  it('substitutes {previous} literally when the previous result contains $ patterns', async () => {
    getSubagentsServiceMock.mockReturnValue(subagentsServiceMock);
    subagentsServiceMock.spawn.mockClear();
    subagentsServiceMock.spawn.mockImplementation((agent: string) =>
      agent === 'builder' ? 'id-a' : 'id-b',
    );
    // id-a completes with a result containing $ sequences that a string-replacement
    // would corrupt ($& -> the placeholder itself, $' -> trailing text, $1 -> empty).
    subagentsServiceMock.getRecord.mockImplementation((id: string) => {
      if (id === 'id-a') {
        return { result: 'Use `echo $&` and $1 args', status: 'completed' };
      }
      return { result: 'DONE', status: 'completed' };
    });

    const { toolDef } = install();

    await toolDef.execute(
      'call-1',
      {
        mode: 'chain',
        tasks: [
          { agent: 'builder', task: 'build the base' },
          { agent: 'architect', task: 'Review the prior output: {previous}' },
        ],
      },
      undefined,
      undefined,
      {},
    );

    // The second spawn must receive the literal previous result - no $ corruption.
    const secondSpawnTask = subagentsServiceMock.spawn.mock.calls[1][1];
    expect(secondSpawnTask).toBe('Review the prior output: Use `echo $&` and $1 args');
  });

  it('aborts already-spawned subagents when a later spawn throws', async () => {
    getSubagentsServiceMock.mockReturnValue(subagentsServiceMock);
    const aborted = new Set<string>();
    subagentsServiceMock.abort.mockImplementation((id: string) => {
      aborted.add(id);
      return true;
    });
    subagentsServiceMock.spawn.mockImplementation((agent: string) => {
      if (agent === 'builder') {
        return 'id-a';
      }
      throw new Error('spawn failed for architect');
    });

    const { toolDef } = install();

    const result = await toolDef.execute(
      'call-1',
      {
        mode: 'parallel',
        tasks: [
          { agent: 'builder', task: 'build the base' },
          { agent: 'architect', task: 'design the extension' },
        ],
      },
      undefined,
      undefined,
      {},
    );

    // Dispatch failed -> handoff fallback, but the spawned subagent was not orphaned.
    expect(result.content[0].text).toContain('Subagent Handoff Required');
    expect(aborted.has('id-a')).toBe(true);
  });
});
