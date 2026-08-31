import { SUBAGENT_EVENTS } from '@gotgenes/pi-subagents';
import { MAESTRIA_EVENTS, validateHandoff } from '@maestria/shared-pi/subagent-utils';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { createInitialState } from '@/state.js';
import { installSubagentTool, MAX_PARALLEL_TASKS } from '@/subagent.js';
import type { SubagentToolApi, SubagentToolDefinition, ToolResult } from '@/subagent.js';
import type { SubagentRecord } from '@/subagent-polling.js';

type MockSpawn = (
  agent: string,
  task: string,
  options: { description: string; foreground: boolean; inheritContext: boolean },
) => string;

interface MockSubagentsService {
  abort: ReturnType<typeof vi.fn<(id: string) => boolean>>;
  getRecord: ReturnType<typeof vi.fn<(id: string) => SubagentRecord | undefined>>;
  spawn: ReturnType<typeof vi.fn<MockSpawn>>;
}

type EventHandler = (data: unknown) => void;

interface MockEventBus {
  _emit: (event: string, data: unknown) => void;
  emit: ReturnType<typeof vi.fn<(event: string, data: unknown) => void>>;
  on: ReturnType<typeof vi.fn<(event: string, handler: EventHandler) => () => void>>;
}

interface MockPi {
  appendEntry: ReturnType<typeof vi.fn<SubagentToolApi['appendEntry']>>;
  events?: MockEventBus;
  registerTool: ReturnType<typeof vi.fn<SubagentToolApi['registerTool']>>;
}

// Mock the subagents SDK so execute() can reach recordAndPersist (existing tests
// keep the SDK-unavailable fallback by leaving getSubagentsServiceMock undefined).
const subagentsServiceMock = vi.hoisted<MockSubagentsService>(() => ({
  abort: vi.fn(),
  getRecord: vi.fn(),
  spawn: vi.fn(),
}));
const getSubagentsServiceMock = vi.hoisted(() => vi.fn<() => MockSubagentsService | undefined>());

vi.mock('@gotgenes/pi-subagents', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    getSubagentsService: getSubagentsServiceMock,
  };
});

// Suppress expected console.warn noise from SDK-unavailable fallback paths
vi.spyOn(console, 'warn').mockImplementation(() => {});

const createMockPi = (events?: MockEventBus): MockPi => ({
  appendEntry: vi.fn(),
  ...(events ? { events } : {}),
  registerTool: vi.fn(),
});

const getToolDef = (pi: MockPi): SubagentToolDefinition => {
  const call = pi.registerTool.mock.calls.at(0);
  if (call === undefined) {
    throw new Error('maestria_subagent tool was not registered');
  }
  const [tool] = call;
  if (tool === undefined) {
    throw new Error('maestria_subagent tool definition was not provided');
  }
  return tool;
};

const install = (pi: MockPi, state: ReturnType<typeof createInitialState>): void => {
  installSubagentTool(pi, state);
};

const createMockEventBus = (): MockEventBus => {
  const handlers = new Map<string, EventHandler[]>();
  const on = vi.fn<(event: string, handler: EventHandler) => () => void>((event, handler) => {
    const eventHandlers = handlers.get(event) ?? [];
    eventHandlers.push(handler);
    handlers.set(event, eventHandlers);
    return () => {};
  });
  return {
    _emit: (event, data) => {
      for (const handler of handlers.get(event) ?? []) {
        handler(data);
      }
    },
    emit: vi.fn<(event: string, data: unknown) => void>(),
    on,
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getPersistedState = (pi: MockPi): Record<string, unknown> => {
  const call = pi.appendEntry.mock.calls.find(([type]) => type === 'maestria_state');
  const data = call?.[1];
  if (!isRecord(data)) {
    throw new Error('maestria_state entry was not persisted');
  }
  return data;
};

const getPersistedSubagentStatus = (pi: MockPi, id: string): Record<string, unknown> => {
  const persisted = getPersistedState(pi);
  const statuses = persisted.subagentStatus;
  if (!isRecord(statuses) || !isRecord(statuses[id])) {
    throw new Error(`Persisted status for ${id} was not found`);
  }
  return statuses[id];
};

const getEmittedEvent = (events: MockEventBus, eventName: string): Record<string, unknown> => {
  const call = events.emit.mock.calls.find(([name]) => name === eventName);
  const data = call?.[1];
  if (!isRecord(data)) {
    throw new Error(`${eventName} event was not emitted`);
  }
  return data;
};

const getResultText = (result: ToolResult): string => {
  const [content] = result.content;
  if (content === undefined) {
    throw new Error('Subagent result did not include content');
  }
  return content.text;
};

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
    const pi = createMockPi();
    const state = createInitialState();
    install(pi, state);
    const toolDef = getToolDef(pi);
    expect(toolDef.name).toBe('maestria_subagent');
  });

  it('returns an actionable message for unknown agent names', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    install(pi, state);

    const toolDef = getToolDef(pi);
    const result = await toolDef.execute(
      'call-1',
      { agent: 'unknown', task: 'do something' },
      undefined,
      undefined,
      {},
    );
    const [firstContent] = result.content;
    if (firstContent === undefined) {
      throw new Error('Subagent result did not include content');
    }
    const { text } = firstContent;
    expect(text).toContain('Invalid maestria_subagent call');
    expect(text).toContain('agent');
    expect(text).toContain('adventurer');
  });

  it('returns an actionable message when agent is missing', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    install(pi, state);

    const toolDef = getToolDef(pi);
    const result = await toolDef.execute(
      'call-1',
      { task: 'do something' },
      undefined,
      undefined,
      {},
    );
    const [firstContent] = result.content;
    if (firstContent === undefined) {
      throw new Error('Subagent result did not include content');
    }
    const { text } = firstContent;
    expect(text).toContain('Invalid maestria_subagent call');
    expect(text).toContain('agent');
  });

  it('rejects empty task description', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    install(pi, state);

    const toolDef = getToolDef(pi);
    await expect(
      toolDef.execute('call-1', { agent: 'builder', task: '' }, undefined, undefined, {}),
    ).rejects.toThrow('Task description is required');
  });

  it('falls back to handoff text when SDK is unavailable', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    install(pi, state);

    const toolDef = getToolDef(pi);
    const result = await toolDef.execute(
      'call-1',
      { agent: 'builder', task: 'do something' },
      undefined,
      undefined,
      {},
    );
    expect(getResultText(result)).toContain('## Subagent Dispatch Unavailable');
  });

  it('works with explicit mode=single', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    install(pi, state);

    const toolDef = getToolDef(pi);
    const result = await toolDef.execute(
      'call-1',
      { agent: 'builder', mode: 'single', task: 'do something' },
      undefined,
      undefined,
      {},
    );
    expect(getResultText(result)).toContain('## Subagent Dispatch Unavailable');
  });
});

describe('installSubagentTool - parallel mode', () => {
  it('throws for 1 task (below minimum of 2)', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    install(pi, state);

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

  it('throws for more than 8 tasks', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    install(pi, state);

    const toolDef = getToolDef(pi);
    const tasks = Array.from({ length: 9 }, (_, i) => ({
      agent: 'builder' as const,
      task: `task ${i + 1}`,
    }));
    await expect(
      toolDef.execute('call-1', { mode: 'parallel', tasks }, undefined, undefined, {}),
    ).rejects.toThrow('at most 8');
  });

  it('throws for unknown agent in tasks', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    install(pi, state);

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
    install(pi, state);

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

  it('falls back to handoff text when SDK is unavailable (valid parallel)', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    install(pi, state);

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
    expect(getResultText(result)).toContain('## Subagent Dispatch Unavailable');
  });
});

describe('installSubagentTool - chain mode', () => {
  it('throws for 1 task (below minimum of 2)', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    install(pi, state);

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
    install(pi, state);

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

  it('falls back to handoff text when SDK is unavailable (valid chain)', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    install(pi, state);

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
    expect(getResultText(result)).toContain('## Subagent Dispatch Unavailable');
  });
});

describe('installSubagentTool - event subscription persistence', () => {
  it('persists state on STARTED event', () => {
    const events = createMockEventBus();
    const pi = createMockPi(events);
    const state = createInitialState();
    install(pi, state);

    events._emit(SUBAGENT_EVENTS.STARTED, { id: 'agent-1', type: 'builder' });

    expect(state.subagentStatus['agent-1']).toBeDefined();
    expect(state.subagentStatus['agent-1'].status).toBe('running');
    expect(pi.appendEntry).toHaveBeenCalled();
    expect(getPersistedSubagentStatus(pi, 'agent-1').status).toBe('running');
  });

  it('persists state on COMPLETED event', () => {
    const events = createMockEventBus();
    const pi = createMockPi(events);
    const state = createInitialState();
    state.subagentStatus['agent-1'] = {
      startedAt: Date.now(),
      status: 'running',
      type: 'builder',
    };
    install(pi, state);

    events._emit(SUBAGENT_EVENTS.COMPLETED, { id: 'agent-1' });

    expect(state.subagentStatus['agent-1'].status).toBe('completed');
    expect(pi.appendEntry).toHaveBeenCalled();
    expect(getPersistedSubagentStatus(pi, 'agent-1').status).toBe('completed');
  });

  it('persists state on FAILED event', () => {
    const events = createMockEventBus();
    const pi = createMockPi(events);
    const state = createInitialState();
    state.subagentStatus['agent-1'] = {
      startedAt: Date.now(),
      status: 'running',
      type: 'builder',
    };
    install(pi, state);

    events._emit(SUBAGENT_EVENTS.FAILED, { id: 'agent-1', status: 'error' });

    expect(state.subagentStatus['agent-1'].status).toBe('error');
    expect(pi.appendEntry).toHaveBeenCalled();
    expect(getPersistedSubagentStatus(pi, 'agent-1').status).toBe('error');
  });

  it('persists state on STEERED event when agent is new', () => {
    const events = createMockEventBus();
    const pi = createMockPi(events);
    const state = createInitialState();
    install(pi, state);

    events._emit(SUBAGENT_EVENTS.STEERED, { id: 'agent-new' });

    expect(state.subagentStatus['agent-new']).toBeDefined();
    expect(state.subagentStatus['agent-new'].status).toBe('running');
    expect(pi.appendEntry).toHaveBeenCalled();
    expect(getPersistedSubagentStatus(pi, 'agent-new').status).toBe('running');
  });

  it('persists state on STEERED event when agent already exists', () => {
    const events = createMockEventBus();
    const pi = createMockPi(events);
    const state = createInitialState();
    state.subagentStatus['existing-agent'] = {
      startedAt: Date.now(),
      status: 'running',
      type: 'architect',
    };
    install(pi, state);

    events._emit(SUBAGENT_EVENTS.STEERED, { id: 'existing-agent' });

    // Existing agent should remain untouched
    expect(state.subagentStatus['existing-agent'].status).toBe('running');
    // State should be persisted regardless
    expect(pi.appendEntry).toHaveBeenCalled();
    expect(getPersistedState(pi)).toBeDefined();
  });

  it('emits maestria:subagent:started on STARTED event', () => {
    const events = createMockEventBus();
    const pi = createMockPi(events);
    const state = createInitialState();
    install(pi, state);

    events._emit(SUBAGENT_EVENTS.STARTED, { id: 'agent-1', type: 'builder' });

    const event = getEmittedEvent(events, MAESTRIA_EVENTS.SUBAGENT_STARTED);
    expect(event.id).toBe('agent-1');
    expect(event.type).toBe('builder');
    expect(typeof event.timestamp).toBe('number');
  });

  it('emits maestria:subagent:completed on COMPLETED event', () => {
    const events = createMockEventBus();
    const pi = createMockPi(events);
    const state = createInitialState();
    state.subagentStatus['agent-1'] = {
      startedAt: Date.now(),
      status: 'running',
      type: 'builder',
    };
    install(pi, state);

    events._emit(SUBAGENT_EVENTS.COMPLETED, { id: 'agent-1' });

    const event = getEmittedEvent(events, MAESTRIA_EVENTS.SUBAGENT_COMPLETED);
    expect(event.id).toBe('agent-1');
    expect(event.type).toBe('builder');
    expect(typeof event.timestamp).toBe('number');
  });

  it('emits maestria:subagent:failed on FAILED event', () => {
    const events = createMockEventBus();
    const pi = createMockPi(events);
    const state = createInitialState();
    state.subagentStatus['agent-1'] = {
      startedAt: Date.now(),
      status: 'running',
      type: 'builder',
    };
    install(pi, state);

    events._emit(SUBAGENT_EVENTS.FAILED, { id: 'agent-1', status: 'error' });

    const event = getEmittedEvent(events, MAESTRIA_EVENTS.SUBAGENT_FAILED);
    expect(event.id).toBe('agent-1');
    expect(event.type).toBe('builder');
    expect(typeof event.timestamp).toBe('number');
  });
});

describe('installSubagentTool - validation errors without tasks', () => {
  it('throws for mode=parallel without tasks', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    install(pi, state);

    const toolDef = getToolDef(pi);
    await expect(
      toolDef.execute('call-1', { mode: 'parallel' }, undefined, undefined, {}),
    ).rejects.toThrow('tasks array is required');
  });

  it('throws for mode=chain without tasks', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    install(pi, state);

    const toolDef = getToolDef(pi);
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
    const pi = createMockPi();
    const state = createInitialState();
    install(pi, state);

    const toolDef = getToolDef(pi);
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
    expect(getPersistedState(pi).specialistsDelegated).toEqual(['builder']);
  });

  it('deduplicates specialists across repeated delegation', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    install(pi, state);

    const toolDef = getToolDef(pi);
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
  const installTool = (): {
    pi: MockPi;
    state: ReturnType<typeof createInitialState>;
    toolDef: SubagentToolDefinition;
  } => {
    const pi = createMockPi();
    const state = createInitialState();
    install(pi, state);
    const toolDef = getToolDef(pi);
    return { pi, state, toolDef };
  };

  it('preserves completed results when one subagent is cleaned up (poll throws)', async () => {
    getSubagentsServiceMock.mockReturnValue(subagentsServiceMock);
    subagentsServiceMock.spawn.mockImplementation((agent: string) =>
      agent === 'builder' ? 'id-a' : 'id-b',
    );
    // id-a completes with a result; id-b's record disappears -> poll throws
    // "cleaned up before completion" -> the failed outcome must not discard
    // id-a's completed result.
    subagentsServiceMock.getRecord.mockImplementation((id: string) =>
      id === 'id-a' ? { result: 'RESULT_A_OK', status: 'completed' } : undefined,
    );

    const { toolDef } = installTool();

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
    const [firstContent] = result.content;
    if (firstContent === undefined) {
      throw new Error('Subagent result did not include content');
    }
    const { text } = firstContent;
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
      return id === 'id-a' ? { status: 'running' } : undefined;
    });

    const { toolDef } = installTool();

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
    subagentsServiceMock.getRecord.mockImplementation((id: string) =>
      id === 'id-a' ? { result: 'STEP_A_OK', status: 'completed' } : undefined,
    );

    const { toolDef } = installTool();

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
    const [firstContent] = result.content;
    if (firstContent === undefined) {
      throw new Error('Subagent result did not include content');
    }
    const { text } = firstContent;
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

    const { toolDef } = installTool();

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
    const secondSpawnCall = subagentsServiceMock.spawn.mock.calls.at(1);
    if (secondSpawnCall === undefined) {
      throw new Error('Second subagent was not spawned');
    }
    const [, secondSpawnTask] = secondSpawnCall;
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

    const { toolDef } = installTool();

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
    expect(getResultText(result)).toContain('Subagent Handoff Required');
    expect(aborted.has('id-a')).toBe(true);
  });
});
