import type { ExtensionAPI } from '@oh-my-pi/pi-coding-agent';
import { describe, expect, it, vi } from 'vite-plus/test';

import { createInitialState } from '@/state.js';
import type { MaestriaState } from '@/state.js';
import { installNativeSubagentTool } from '@/subagent.js';
import type { SubagentToolParams, SubagentToolResult } from '@/subagent.js';

interface ZodChainable {
  describe: (description: string) => ZodChainable;
  optional: () => ZodChainable;
}

const zodChainable = (): ZodChainable => ({
  describe: zodChainable,
  optional: zodChainable,
});

interface RegisteredTool {
  description: string;
  execute: (
    toolCallId: string,
    params: SubagentToolParams,
    signal: AbortSignal | undefined,
    onUpdate: unknown,
    ctx: unknown,
  ) => Promise<SubagentToolResult>;
  label: string;
  name: string;
  parameters: unknown;
}

interface MockPi {
  appendEntry: ReturnType<typeof vi.fn<(type: string, data: unknown) => void>>;
  on: ReturnType<typeof vi.fn<(event: string, handler: unknown) => void>>;
  registerTool: ReturnType<typeof vi.fn<(tool: RegisteredTool) => void>>;
  zod: {
    array: ReturnType<typeof vi.fn<(schema: ZodChainable) => ZodChainable>>;
    enum: ReturnType<typeof vi.fn<(values: readonly string[]) => ZodChainable>>;
    object: ReturnType<typeof vi.fn<(shape: Record<string, ZodChainable>) => ZodChainable>>;
    string: ReturnType<typeof vi.fn<() => ZodChainable>>;
  };
}

const createMockPi = (): MockPi => ({
  appendEntry: vi.fn<(type: string, data: unknown) => void>(),
  on: vi.fn<(event: string, handler: unknown) => void>(),
  registerTool: vi.fn<(tool: RegisteredTool) => void>(),
  zod: {
    array: vi.fn(zodChainable),
    enum: vi.fn(zodChainable),
    object: vi.fn(zodChainable),
    string: vi.fn(zodChainable),
  },
});

const getToolDef = (pi: MockPi): RegisteredTool => {
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

const install = (pi: MockPi, state: MaestriaState): void => {
  // The fake supplies only the ExtensionAPI members installNativeSubagentTool
  // consumes; the host SDK type cannot be satisfied structurally by a test stub.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  installNativeSubagentTool(pi as unknown as ExtensionAPI, state);
};

describe('installNativeSubagentTool - tool registration', () => {
  it('registers a tool named "maestria_subagent"', () => {
    const pi = createMockPi();
    const state = createInitialState();
    install(pi, state);
    const toolDef = getToolDef(pi);
    expect(toolDef.name).toBe('maestria_subagent');
  });

  it('registers the tool with label and description', () => {
    const pi = createMockPi();
    const state = createInitialState();
    install(pi, state);
    const toolDef = getToolDef(pi);
    expect(toolDef.label).toBe('Maestria Subagent');
    expect(toolDef.description).toContain('Dispatch a task to a maestria specialist subagent');
  });

  it('defines parameters using pi.zod', () => {
    const pi = createMockPi();
    const state = createInitialState();
    install(pi, state);
    expect(pi.zod.object).toHaveBeenCalled();
    expect(pi.zod.string).toHaveBeenCalled();
    expect(pi.zod.array).toHaveBeenCalled();
  });
});

describe('installNativeSubagentTool - ExtensionAPI integration', () => {
  it('registers exactly one tool and no lifecycle event subscriptions', () => {
    const pi = createMockPi();
    install(pi, createInitialState());
    expect(pi.registerTool).toHaveBeenCalledTimes(1);
    expect(pi.on).not.toHaveBeenCalled();
  });

  it('builds the parameter schema through the native pi.zod member', () => {
    const pi = createMockPi();
    install(pi, createInitialState());
    const shapes = pi.zod.object.mock.calls.map(([shape]) => shape);
    const outerShape = shapes.find((shape) => 'tasks' in shape);
    expect(outerShape).toBeDefined();
    expect(Object.keys(outerShape ?? {}).toSorted()).toEqual(['agent', 'mode', 'task', 'tasks']);
    expect(pi.zod.enum).toHaveBeenCalledWith(['parallel', 'chain', 'single']);
    expect(pi.zod.array).toHaveBeenCalledTimes(1);
  });
});

describe('installNativeSubagentTool - single mode', () => {
  it('rejects unknown agent names', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    install(pi, state);

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
    install(pi, state);

    const toolDef = getToolDef(pi);
    await expect(
      toolDef.execute('call-1', { agent: 'builder', task: '' }, undefined, undefined, {}),
    ).rejects.toThrow('Task description is required');
  });

  it('returns delegation prompt for valid single mode', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    install(pi, state);

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

describe('installNativeSubagentTool - parallel mode', () => {
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

  it('returns dispatch plan for valid parallel mode', async () => {
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
    expect(result.content[0].text).toContain('## Parallel Dispatch Plan');
    expect(result.content[0].text).toContain('builder');
    expect(result.content[0].text).toContain('architect');
    expect(result.content[0].text).toContain('task(agent: "builder"');
    expect(result.content[0].text).toContain('task(agent: "architect"');
  });
});

describe('installNativeSubagentTool - chain mode', () => {
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

  it('returns dispatch plan for valid chain mode', async () => {
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
    expect(result.content[0].text).toContain('## Chain Dispatch Plan');
    expect(result.content[0].text).toContain('builder');
    expect(result.content[0].text).toContain('reviewer');
    expect(result.content[0].text).toContain('{previous}');
  });
});

describe('installNativeSubagentTool - review mode blocks', () => {
  it('blocks dispatch during review mode', async () => {
    const pi = createMockPi();
    const state = { ...createInitialState(), reviewMode: true };
    install(pi, state);

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

describe('installNativeSubagentTool - validation errors', () => {
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

describe('installNativeSubagentTool - handoff recording', () => {
  it('records handoff in state for single mode', async () => {
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
    expect(state.handoffHistory[0].from).toBe('orchestrator');
    expect(state.handoffHistory[0].to).toBe('builder');
    expect(state.handoffHistory[0].task).toBe('build the feature');
    expect(state.specialistsDelegated).toEqual(['builder']);
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

  it('records handoffs in state for parallel mode', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    install(pi, state);

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
    // specialistsDelegated appends in delegation order (taskList order), unlike
    // handoffHistory which prepends (most recent first).
    expect(state.specialistsDelegated).toEqual(['builder', 'architect']);
  });

  it('persists state via appendEntry after handoff recording', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    install(pi, state);

    const toolDef = getToolDef(pi);
    await toolDef.execute('call-1', { agent: 'builder', task: 'build' }, undefined, undefined, {});

    expect(pi.appendEntry).toHaveBeenCalledWith('maestria_state', state);
  });
});
