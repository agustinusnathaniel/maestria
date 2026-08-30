import { describe, it, expect, vi } from 'vite-plus/test';
import type { ExtensionAPI } from '@oh-my-pi/pi-coding-agent';
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
    zod: {
      object: vi.fn(() => {
        return {};
      }),
      string: vi.fn(() => {
        return {
          describe: vi.fn(() => {
            return {
              optional: vi.fn(() => {
                return {};
              }),
            };
          }),
        };
      }),
      array: vi.fn(() => {
        return {
          describe: vi.fn(() => {
            return {
              optional: vi.fn(() => {
                return {};
              }),
            };
          }),
        };
      }),
      enum: vi.fn(() => {
        return {
          describe: vi.fn(() => {
            return {
              optional: vi.fn(() => {
                return {};
              }),
            };
          }),
        };
      }),
    },
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
    expect(onEvents).toContain('tool_call');
    expect(onEvents).toContain('goal_updated');
    expect(onEvents).toContain('session_switch');
    expect(onEvents).toContain('session_branch');
    expect(onEvents).toContain('session_tree');
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

  it('leaves OMP-owned native goal slash commands outside Maestria command registration', () => {
    const pi = createMockPi();
    extension(pi as unknown as ExtensionAPI);

    expect(pi.registerCommand).not.toHaveBeenCalledWith('goal', expect.anything());
  });

  it('restores state on session_start from custom entries', async () => {
    const pi = createMockPi();
    const mockState = { mode: 'fein', activeTask: 'test task' };
    const getBranch = vi.fn(() => {
      return [{ type: 'custom', customType: 'maestria_state', data: mockState, timestamp: 100 }];
    });
    const ctx = { sessionManager: { getBranch } };
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

  it('resets copied native state through tree navigation without inventing a goal event', async () => {
    const pi = createMockPi();
    extension(pi as unknown as ExtensionAPI);
    const onCalls = (pi.on as ReturnType<typeof vi.fn>).mock.calls;
    const sessionStart = onCalls.find((c: unknown[]) => {
      return c[0] === 'session_start';
    })![1];
    const sessionTree = onCalls.find((c: unknown[]) => {
      return c[0] === 'session_tree';
    })![1];
    const getBranch = vi.fn();
    const context = { sessionManager: { getBranch, getEntries: getBranch } };
    const parentState = {
      mode: 'fein',
      activeTask: 'parent task',
      nativeGoal: { objective: 'parent goal', status: 'active' },
    };
    getBranch.mockReturnValue([
      { type: 'custom', customType: 'maestria_state', data: parentState },
    ]);

    await sessionStart({ type: 'session_start' }, context);
    await sessionTree(
      { type: 'session_tree', oldLeafId: 'parent-leaf', newLeafId: 'target-leaf' },
      context,
    );

    const statusCommand = (pi.registerCommand as ReturnType<typeof vi.fn>).mock.calls.find(
      (call: unknown[]) => {
        return call[0] === 'maestria-status';
      },
    )![1] as { handler: (args: string, ctx: unknown) => Promise<void> };
    const setEditorText = vi.fn();
    const commandContext = { ui: { setEditorText, notify: vi.fn() } };
    await statusCommand.handler('', commandContext);
    expect(setEditorText).toHaveBeenCalledWith(expect.stringContaining('**Goal:** parent task'));
    expect(setEditorText).toHaveBeenCalledWith(expect.not.stringContaining('**Native Goal:**'));
  });
});
