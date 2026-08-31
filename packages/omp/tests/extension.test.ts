import { describe, expect, it, vi } from 'vite-plus/test';

import extension from '@/extension.js';

interface MockSchema {
  describe: (description: string) => MockSchema;
  optional: () => MockSchema;
}

interface MockZod {
  array: (schema: MockSchema) => MockSchema;
  enum: (values: readonly string[]) => MockSchema;
  object: (shape: Record<string, MockSchema>) => MockSchema;
  string: () => MockSchema;
}

type MockEventHandler = (...args: unknown[]) => unknown;
type MockOn = (event: string, handler: MockEventHandler) => void;
type MockCommandRegistration = (name: string, options: unknown) => void;
type MockToolRegistration = (tool: unknown) => void;

interface MockPi {
  appendEntry: ReturnType<typeof vi.fn<(type: string, data?: unknown) => void>>;
  events: undefined;
  getActiveTools: ReturnType<typeof vi.fn<() => string[]>>;
  on: ReturnType<typeof vi.fn<MockOn>>;
  registerCommand: ReturnType<typeof vi.fn<MockCommandRegistration>>;
  registerTool: ReturnType<typeof vi.fn<MockToolRegistration>>;
  sendUserMessage: ReturnType<typeof vi.fn<(text: string, options?: unknown) => void>>;
  setActiveTools: ReturnType<typeof vi.fn<(tools: string[]) => void>>;
  setModel: ReturnType<typeof vi.fn<(model: unknown) => Promise<boolean>>>;
  zod: MockZod;
}

const createMockZod = (): MockZod => {
  const schema: MockSchema = {
    describe: () => schema,
    optional: () => schema,
  };
  return {
    array: () => schema,
    enum: () => schema,
    object: () => schema,
    string: () => schema,
  };
};

const invokeExtension = (pi: MockPi): void => {
  Reflect.apply(extension, undefined, [pi]);
};

const createMockPi = (): MockPi => ({
  appendEntry: vi.fn<(type: string, data?: unknown) => void>(),
  events: undefined,
  getActiveTools: vi.fn<() => string[]>(() => []),
  on: vi.fn<MockOn>(),
  registerCommand: vi.fn<MockCommandRegistration>(),
  registerTool: vi.fn<MockToolRegistration>(),
  sendUserMessage: vi.fn<(text: string, options?: unknown) => void>(),
  setActiveTools: vi.fn<(tools: string[]) => void>(),
  setModel: vi.fn<(model: unknown) => Promise<boolean>>(),
  zod: createMockZod(),
});

const invokeHandler = async (pi: MockPi, eventName: string, ...args: unknown[]): Promise<void> => {
  const registration = pi.on.mock.calls.find((call) => call[0] === eventName);
  if (registration === undefined) {
    throw new Error(`${eventName} handler was not registered`);
  }
  const [, handler] = registration;
  if (typeof handler !== 'function') {
    throw new TypeError(`${eventName} handler is not callable`);
  }
  await Reflect.apply(handler, undefined, args);
};

describe('extension entry point', () => {
  it('registers mode commands', () => {
    const pi = createMockPi();
    invokeExtension(pi);
    const { registerCommand } = pi;
    // Three mode commands: fein, sonar, blitz
    expect(registerCommand).toHaveBeenCalledWith('fein', expect.any(Object));
    expect(registerCommand).toHaveBeenCalledWith('sonar', expect.any(Object));
    expect(registerCommand).toHaveBeenCalledWith('blitz', expect.any(Object));
  });

  it('registers subagent tool', () => {
    const pi = createMockPi();
    invokeExtension(pi);
    const { registerTool } = pi;
    expect(registerTool).toHaveBeenCalled();
  });

  it('subscribes to session events', () => {
    const pi = createMockPi();
    invokeExtension(pi);
    const onEvents = pi.on.mock.calls.map((call) => call[0]);
    expect(onEvents).toContain('session_start');
    expect(onEvents).toContain('session_shutdown');
    expect(onEvents).toContain('before_agent_start');
    expect(onEvents).toContain('tool_call');
    expect(onEvents).toContain('goal_updated');
    expect(onEvents).toContain('session_switch');
    expect(onEvents).toContain('session_branch');
    expect(onEvents).toContain('session_tree');
  });

  it('registers orchestration commands', () => {
    const pi = createMockPi();
    invokeExtension(pi);
    const { registerCommand } = pi;
    expect(registerCommand).toHaveBeenCalledWith('maestria-status', expect.any(Object));
    expect(registerCommand).toHaveBeenCalledWith('review', expect.any(Object));
    expect(registerCommand).toHaveBeenCalledWith('restore-model', expect.any(Object));
    expect(registerCommand).toHaveBeenCalledWith('handoff', expect.any(Object));
    expect(registerCommand).toHaveBeenCalledWith('review-model', expect.any(Object));
  });

  it('leaves OMP-owned native goal slash commands outside Maestria command registration', () => {
    const pi = createMockPi();
    invokeExtension(pi);

    expect(pi.registerCommand).not.toHaveBeenCalledWith('goal', expect.anything());
  });

  it('restores state on session_start from custom entries', async () => {
    const pi = createMockPi();
    const mockState = { activeTask: 'test task', mode: 'fein' };
    const getBranch = vi.fn(() => [
      { customType: 'maestria_state', data: mockState, timestamp: 100, type: 'custom' },
    ]);
    const ctx = { sessionManager: { getBranch } };
    invokeExtension(pi);
    await invokeHandler(pi, 'session_start', {}, ctx);
    expect(getBranch).toHaveBeenCalled();
  });

  it('resets copied native state through tree navigation without inventing a goal event', async () => {
    const pi = createMockPi();
    invokeExtension(pi);
    const getBranch = vi.fn();
    const context = { sessionManager: { getBranch, getEntries: getBranch } };
    const parentState = {
      activeTask: 'parent task',
      mode: 'fein',
      nativeGoal: { objective: 'parent goal', status: 'active' },
    };
    getBranch.mockReturnValue([
      { customType: 'maestria_state', data: parentState, type: 'custom' },
    ]);

    await invokeHandler(pi, 'session_start', { type: 'session_start' }, context);
    await invokeHandler(
      pi,
      'session_tree',
      { newLeafId: 'target-leaf', oldLeafId: 'parent-leaf', type: 'session_tree' },
      context,
    );

    const statusCall = pi.registerCommand.mock.calls.find((call) => call[0] === 'maestria-status');
    if (statusCall === undefined) {
      throw new Error('maestria-status command was not registered');
    }
    const [, statusDefinition] = statusCall;
    if (
      typeof statusDefinition !== 'object' ||
      statusDefinition === null ||
      !('handler' in statusDefinition) ||
      typeof statusDefinition.handler !== 'function'
    ) {
      throw new TypeError('maestria-status definition is invalid');
    }
    const setEditorText = vi.fn();
    const commandContext = { ui: { notify: vi.fn(), setEditorText } };
    await Reflect.apply(statusDefinition.handler, undefined, ['', commandContext]);
    expect(setEditorText).toHaveBeenCalledWith(expect.stringContaining('**Goal:** parent task'));
    expect(setEditorText).toHaveBeenCalledWith(expect.not.stringContaining('**Native Goal:**'));
  });
});
