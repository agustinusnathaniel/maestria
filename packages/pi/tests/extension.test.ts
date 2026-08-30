import { describe, it, expect, vi } from 'vite-plus/test';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import extension from '@/extension.js';

function createMockPi() {
  const handlers = new Map<string, Array<(...args: unknown[]) => unknown>>();
  return {
    on: vi.fn((event: string, handler: (...args: unknown[]) => unknown) => {
      if (!handlers.has(event)) {
        handlers.set(event, []);
      }
      handlers.get(event)!.push(handler);
      return () => {
        const h = handlers.get(event);
        if (h) {
          h.splice(h.indexOf(handler), 1);
        }
      };
    }),
    registerCommand: vi.fn(),
    registerTool: vi.fn(),
    setActiveTools: vi.fn(),
    getActiveTools: vi.fn(() => {
      return [];
    }),
    setModel: vi.fn(),
    appendEntry: vi.fn(),
    sendUserMessage: vi.fn(),
    events: undefined,
  };
}

describe('extension entry point', () => {
  it('registers mode commands', async () => {
    const pi = createMockPi();
    extension(pi as unknown as ExtensionAPI);
    const { registerCommand } = pi;
    // Three mode commands: fein, sonar, blitz
    expect(registerCommand).toHaveBeenCalledWith('fein', expect.any(Object));
    expect(registerCommand).toHaveBeenCalledWith('sonar', expect.any(Object));
    expect(registerCommand).toHaveBeenCalledWith('blitz', expect.any(Object));
  });

  it('registers subagent tool', async () => {
    const pi = createMockPi();
    extension(pi as unknown as ExtensionAPI);
    const { registerTool } = pi;
    expect(registerTool).toHaveBeenCalled();
  });

  it('subscribes to session events', async () => {
    const pi = createMockPi();
    extension(pi as unknown as ExtensionAPI);
    const { on } = pi;
    const onCalls = (on as ReturnType<typeof vi.fn>).mock.calls;
    const onEvents = onCalls.map((c: unknown[]) => {
      return c[0];
    });
    expect(onEvents).toContain('session_start');
    expect(onEvents).toContain('session_shutdown');
    expect(onEvents).toContain('before_agent_start');
    expect(onEvents).toContain('session_tree');
    expect(onEvents).toContain('tool_call');
  });

  it('registers orchestration commands', async () => {
    const pi = createMockPi();
    extension(pi as unknown as ExtensionAPI);
    const { registerCommand } = pi;
    expect(registerCommand).toHaveBeenCalledWith('maestria-status', expect.any(Object));
    expect(registerCommand).toHaveBeenCalledWith('review', expect.any(Object));
    expect(registerCommand).toHaveBeenCalledWith('restore-model', expect.any(Object));
    expect(registerCommand).toHaveBeenCalledWith('handoff', expect.any(Object));
    expect(registerCommand).toHaveBeenCalledWith('review-model', expect.any(Object));
  });

  it('restores state on session_start from the current branch', async () => {
    const pi = createMockPi();
    const mockState = { mode: 'fein', activeTask: 'test task' };
    const siblingState = { mode: 'sonar', activeTask: 'sibling task' };
    const entries = [
      { type: 'custom', customType: 'maestria_state', data: siblingState, timestamp: 50 },
    ];
    const getBranch = vi.fn(() => {
      return [{ type: 'custom', customType: 'maestria_state', data: mockState, timestamp: 100 }];
    });
    const getEntries = vi.fn(() => {
      return [
        ...entries,
        { type: 'custom', customType: 'maestria_state', data: mockState, timestamp: 100 },
      ];
    });
    const ctx = { sessionManager: { getBranch, getEntries } };
    extension(pi as unknown as ExtensionAPI);
    const { on } = pi;
    const onCalls = (on as ReturnType<typeof vi.fn>).mock.calls;
    const sessionStartCall = onCalls.find((c: unknown[]) => {
      return c[0] === 'session_start';
    });
    expect(sessionStartCall).toBeDefined();
    const handler = sessionStartCall![1];
    await handler({}, ctx);
    expect(getBranch).toHaveBeenCalled();
  });

  it('does not restore sibling-branch state on session_start', async () => {
    const pi = createMockPi();
    const mockState = { mode: 'fein', activeTask: 'test task' };
    const siblingState = { mode: 'sonar', activeTask: 'sibling task' };
    const branchEntries = [
      { type: 'custom', customType: 'maestria_state', data: mockState, timestamp: 100 },
    ];
    const allEntries = [
      { type: 'custom', customType: 'maestria_state', data: siblingState, timestamp: 50 },
      ...branchEntries,
    ];
    const getBranch = vi.fn(() => {
      return branchEntries;
    });
    const getEntries = vi.fn(() => {
      return allEntries;
    });
    const ctx = { sessionManager: { getBranch, getEntries } };
    extension(pi as unknown as ExtensionAPI);
    const { on } = pi;
    const onCalls = (on as ReturnType<typeof vi.fn>).mock.calls;
    const sessionStartCall = onCalls.find((c: unknown[]) => {
      return c[0] === 'session_start';
    });
    const handler = sessionStartCall![1];
    await handler({}, ctx);

    const statusCall = (pi.registerCommand as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => {
        return c[0] === 'maestria-status';
      },
    );
    expect(statusCall).toBeDefined();
    const setEditorText = vi.fn();
    await statusCall![1].handler('', { ui: { setEditorText } });
    const text = setEditorText.mock.calls[0][0] as string;
    expect(text).toContain('test task');
    expect(text).not.toContain('sibling task');
  });

  it('registers a session_tree handler that restores state from the current branch', async () => {
    const pi = createMockPi();
    const mockState = { mode: 'fein', activeTask: 'test task' };
    const getBranch = vi.fn(() => {
      return [{ type: 'custom', customType: 'maestria_state', data: mockState, timestamp: 100 }];
    });
    const getEntries = vi.fn(() => {
      return [{ type: 'custom', customType: 'maestria_state', data: mockState, timestamp: 100 }];
    });
    const ctx = { sessionManager: { getBranch, getEntries } };
    extension(pi as unknown as ExtensionAPI);
    const { on } = pi;
    const onCalls = (on as ReturnType<typeof vi.fn>).mock.calls;
    const sessionTreeCall = onCalls.find((c: unknown[]) => {
      return c[0] === 'session_tree';
    });
    expect(sessionTreeCall).toBeDefined();
    const handler = sessionTreeCall![1];
    await handler({}, ctx);
    expect(getBranch).toHaveBeenCalled();
  });
});
