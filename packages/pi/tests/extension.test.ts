import { describe, it, expect, vi } from 'vite-plus/test';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

function createMockPi() {
  const handlers = new Map<string, Array<(...args: unknown[]) => unknown>>();
  return {
    on: vi.fn((event: string, handler: (...args: unknown[]) => unknown) => {
      if (!handlers.has(event)) handlers.set(event, []);
      handlers.get(event)!.push(handler);
      return () => {
        const h = handlers.get(event);
        if (h) h.splice(h.indexOf(handler), 1);
      };
    }),
    registerCommand: vi.fn(),
    registerTool: vi.fn(),
    setActiveTools: vi.fn(),
    getActiveTools: vi.fn(() => []),
    setModel: vi.fn(),
    appendEntry: vi.fn(),
    sendUserMessage: vi.fn(),
    events: undefined,
  };
}

describe('extension entry point', () => {
  it('registers mode commands', async () => {
    const pi = createMockPi();
    const extension = await import('../src/extension.js');
    extension.default(pi as unknown as ExtensionAPI);
    const { registerCommand } = pi;
    // Three mode commands: fein, sonar, blitz
    expect(registerCommand).toHaveBeenCalledWith('fein', expect.any(Object));
    expect(registerCommand).toHaveBeenCalledWith('sonar', expect.any(Object));
    expect(registerCommand).toHaveBeenCalledWith('blitz', expect.any(Object));
  });

  it('registers subagent tool', async () => {
    const pi = createMockPi();
    const extension = await import('../src/extension.js');
    extension.default(pi as unknown as ExtensionAPI);
    const { registerTool } = pi;
    expect(registerTool).toHaveBeenCalled();
  });

  it('subscribes to session events', async () => {
    const pi = createMockPi();
    const extension = await import('../src/extension.js');
    extension.default(pi as unknown as ExtensionAPI);
    const { on } = pi;
    const onCalls = (on as ReturnType<typeof vi.fn>).mock.calls;
    const onEvents = onCalls.map((c: unknown[]) => c[0]);
    expect(onEvents).toContain('session_start');
    expect(onEvents).toContain('session_shutdown');
    expect(onEvents).toContain('before_agent_start');
    expect(onEvents).toContain('tool_call');
  });

  it('registers orchestration commands', async () => {
    const pi = createMockPi();
    const extension = await import('../src/extension.js');
    extension.default(pi as unknown as ExtensionAPI);
    const { registerCommand } = pi;
    expect(registerCommand).toHaveBeenCalledWith('orchestrate', expect.any(Object));
    expect(registerCommand).toHaveBeenCalledWith('maestria-status', expect.any(Object));
    expect(registerCommand).toHaveBeenCalledWith('review', expect.any(Object));
    expect(registerCommand).toHaveBeenCalledWith('restore-model', expect.any(Object));
    expect(registerCommand).toHaveBeenCalledWith('handoff', expect.any(Object));
    expect(registerCommand).toHaveBeenCalledWith('review-model', expect.any(Object));
  });

  it('restores state on session_start from custom entries', async () => {
    const pi = createMockPi();
    const mockState = { mode: 'fein', activeTask: 'test task' };
    const getEntries = vi.fn(() => [
      { type: 'custom', customType: 'maestria_state', data: mockState, timestamp: 100 },
    ]);
    const ctx = { sessionManager: { getEntries } };
    const extension = await import('../src/extension.js');
    extension.default(pi as unknown as ExtensionAPI);
    const { on } = pi;
    const onCalls = (on as ReturnType<typeof vi.fn>).mock.calls;
    const sessionStartCall = onCalls.find((c: unknown[]) => c[0] === 'session_start');
    expect(sessionStartCall).toBeDefined();
    const handler = sessionStartCall![1];
    await handler({}, ctx);
    expect(getEntries).toHaveBeenCalled();
  });
});
