import type { ExtensionAPI } from '@oh-my-pi/pi-coding-agent';
import { describe, it, expect, vi } from 'vite-plus/test';

import extension from '@/extension.js';

function createMockPi() {
  const handlers = new Map<string, ((...args: unknown[]) => unknown)[]>();
  return {
    appendEntry: vi.fn(),
    events: undefined,
    getActiveTools: vi.fn(() => []),
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
    sendUserMessage: vi.fn(),
    setActiveTools: vi.fn(),
    setModel: vi.fn(),
    zod: {
      array: vi.fn(() => ({
        describe: vi.fn(() => ({
          optional: vi.fn(() => ({})),
        })),
      })),
      enum: vi.fn(() => ({
        describe: vi.fn(() => ({
          optional: vi.fn(() => ({})),
        })),
      })),
      object: vi.fn(() => ({})),
      string: vi.fn(() => ({
        describe: vi.fn(() => ({
          optional: vi.fn(() => ({})),
        })),
      })),
    },
  };
}

describe('extension entry point', () => {
  it('registers mode commands', () => {
    const pi = createMockPi();
    extension(pi as unknown as ExtensionAPI);
    const { registerCommand } = pi;
    // Three mode commands: fein, sonar, blitz
    expect(registerCommand).toHaveBeenCalledWith('fein', expect.any(Object));
    expect(registerCommand).toHaveBeenCalledWith('sonar', expect.any(Object));
    expect(registerCommand).toHaveBeenCalledWith('blitz', expect.any(Object));
  });

  it('registers subagent tool', () => {
    const pi = createMockPi();
    extension(pi as unknown as ExtensionAPI);
    const { registerTool } = pi;
    expect(registerTool).toHaveBeenCalled();
  });

  it('subscribes to session events', () => {
    const pi = createMockPi();
    extension(pi as unknown as ExtensionAPI);
    const { on } = pi;
    const onCalls = (on as ReturnType<typeof vi.fn>).mock.calls;
    const onEvents = onCalls.map((c: unknown[]) => c[0]);
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
    const mockState = { activeTask: 'test task', mode: 'fein' };
    const getBranch = vi.fn(() => [
      { customType: 'maestria_state', data: mockState, timestamp: 100, type: 'custom' },
    ]);
    const ctx = { sessionManager: { getBranch } };
    extension(pi as unknown as ExtensionAPI);
    const { on } = pi;
    const onCalls = (on as ReturnType<typeof vi.fn>).mock.calls;
    const sessionStartCall = onCalls.find((c: unknown[]) => c[0] === 'session_start');
    expect(sessionStartCall).toBeDefined();
    const handler = sessionStartCall![1];
    await handler({}, ctx);
    expect(getBranch).toHaveBeenCalled();
  });

  it('resets copied native state through tree navigation without inventing a goal event', async () => {
    const pi = createMockPi();
    extension(pi as unknown as ExtensionAPI);
    const onCalls = (pi.on as ReturnType<typeof vi.fn>).mock.calls;
    const sessionStart = onCalls.find((c: unknown[]) => c[0] === 'session_start')![1];
    const sessionTree = onCalls.find((c: unknown[]) => c[0] === 'session_tree')![1];
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

    await sessionStart({ type: 'session_start' }, context);
    await sessionTree(
      { newLeafId: 'target-leaf', oldLeafId: 'parent-leaf', type: 'session_tree' },
      context,
    );

    const statusCommand = (pi.registerCommand as ReturnType<typeof vi.fn>).mock.calls.find(
      (call: unknown[]) => call[0] === 'maestria-status',
    )![1] as { handler: (args: string, ctx: unknown) => Promise<void> };
    const setEditorText = vi.fn();
    const commandContext = { ui: { notify: vi.fn(), setEditorText } };
    await statusCommand.handler('', commandContext);
    expect(setEditorText).toHaveBeenCalledWith(expect.stringContaining('**Goal:** parent task'));
    expect(setEditorText).toHaveBeenCalledWith(expect.not.stringContaining('**Native Goal:**'));
  });
});
