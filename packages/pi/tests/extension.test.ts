import { describe, expect, it, vi } from 'vite-plus/test';

import extension from '@/extension.js';

type MockHandler = (...args: unknown[]) => unknown;
interface MockCommand {
  description?: string;
  handler: MockHandler;
}
type MockOn = (event: string, handler: MockHandler) => void;
type MockRegisterCommand = (name: string, command: MockCommand) => void;

interface MockPi {
  appendEntry: ReturnType<typeof vi.fn>;
  events: undefined;
  getActiveTools: ReturnType<typeof vi.fn<() => string[]>>;
  on: ReturnType<typeof vi.fn<MockOn>>;
  registerCommand: ReturnType<typeof vi.fn<MockRegisterCommand>>;
  registerTool: ReturnType<typeof vi.fn>;
  sendUserMessage: ReturnType<typeof vi.fn>;
  setActiveTools: ReturnType<typeof vi.fn>;
  setModel: ReturnType<typeof vi.fn>;
}

const createMockPi = (): MockPi => ({
  appendEntry: vi.fn(),
  events: undefined,
  getActiveTools: vi.fn(() => []),
  on: vi.fn<MockOn>(),
  registerCommand: vi.fn(),
  registerTool: vi.fn(),
  sendUserMessage: vi.fn(),
  setActiveTools: vi.fn(),
  setModel: vi.fn(),
});

const invokeExtension = (pi: MockPi): void => {
  Reflect.apply(extension, undefined, [pi]);
};

const invokeHandler = async (pi: MockPi, eventName: string, ...args: unknown[]): Promise<void> => {
  const registration = pi.on.mock.calls.find(([event]) => event === eventName);
  if (registration === undefined) {
    throw new Error(`${eventName} handler was not registered`);
  }
  const [, handler] = registration;
  if (typeof handler !== 'function') {
    throw new TypeError(`${eventName} handler is not callable`);
  }
  await Reflect.apply(handler, undefined, args);
};

const getCommandHandler = (pi: MockPi, commandName: string): MockHandler => {
  const registration = pi.registerCommand.mock.calls.find(([name]) => name === commandName);
  if (registration === undefined) {
    throw new Error(`${commandName} command was not registered`);
  }
  const [, command] = registration;
  if (
    typeof command !== 'object' ||
    command === null ||
    !('handler' in command) ||
    typeof command.handler !== 'function'
  ) {
    throw new TypeError(`${commandName} command definition is invalid`);
  }
  return command.handler;
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
    const { on } = pi;
    const onEvents = on.mock.calls.map(([event]) => event);
    expect(onEvents).toContain('session_start');
    expect(onEvents).toContain('session_shutdown');
    expect(onEvents).toContain('before_agent_start');
    expect(onEvents).toContain('session_tree');
    expect(onEvents).toContain('tool_call');
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

  it('restores state on session_start from the current branch', async () => {
    const pi = createMockPi();
    const mockState = { activeTask: 'test task', mode: 'fein' };
    const siblingState = { activeTask: 'sibling task', mode: 'sonar' };
    const entries = [
      { customType: 'maestria_state', data: siblingState, timestamp: 50, type: 'custom' },
    ];
    const getBranch = vi.fn(() => [
      { customType: 'maestria_state', data: mockState, timestamp: 100, type: 'custom' },
    ]);
    const getEntries = vi.fn(() => [
      ...entries,
      { customType: 'maestria_state', data: mockState, timestamp: 100, type: 'custom' },
    ]);
    const ctx = { sessionManager: { getBranch, getEntries } };
    invokeExtension(pi);
    await invokeHandler(pi, 'session_start', {}, ctx);
    expect(getBranch).toHaveBeenCalled();
  });

  it('does not restore sibling-branch state on session_start', async () => {
    const pi = createMockPi();
    const mockState = { activeTask: 'test task', mode: 'fein' };
    const siblingState = { activeTask: 'sibling task', mode: 'sonar' };
    const branchEntries = [
      { customType: 'maestria_state', data: mockState, timestamp: 100, type: 'custom' },
    ];
    const allEntries = [
      { customType: 'maestria_state', data: siblingState, timestamp: 50, type: 'custom' },
      ...branchEntries,
    ];
    const getBranch = vi.fn(() => branchEntries);
    const getEntries = vi.fn(() => allEntries);
    const ctx = { sessionManager: { getBranch, getEntries } };
    invokeExtension(pi);
    await invokeHandler(pi, 'session_start', {}, ctx);

    const statusHandler = getCommandHandler(pi, 'maestria-status');
    const setEditorText = vi.fn<(text: string) => void>();
    await Reflect.apply(statusHandler, undefined, ['', { ui: { setEditorText } }]);
    const [text] = setEditorText.mock.calls[0] ?? [];
    if (text === undefined) {
      throw new Error('status command did not set editor text');
    }
    expect(text).toContain('test task');
    expect(text).not.toContain('sibling task');
  });

  it('registers a session_tree handler that restores state from the current branch', async () => {
    const pi = createMockPi();
    const mockState = { activeTask: 'test task', mode: 'fein' };
    const getBranch = vi.fn(() => [
      { customType: 'maestria_state', data: mockState, timestamp: 100, type: 'custom' },
    ]);
    const getEntries = vi.fn(() => [
      { customType: 'maestria_state', data: mockState, timestamp: 100, type: 'custom' },
    ]);
    const ctx = { sessionManager: { getBranch, getEntries } };
    invokeExtension(pi);
    await invokeHandler(pi, 'session_tree', {}, ctx);
    expect(getBranch).toHaveBeenCalled();
  });
});
