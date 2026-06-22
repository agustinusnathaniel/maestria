import { describe, it, expect, vi } from 'vite-plus/test';
import extension from '../src/extension.js';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

function createMockPi(): ExtensionAPI {
  return {
    on: vi.fn(),
    registerTool: vi.fn(),
    registerCommand: vi.fn(),
    events: { on: vi.fn() },
    appendEntry: vi.fn(),
    setModel: vi.fn(),
    setActiveTools: vi.fn(),
    getActiveTools: vi.fn(() => []),
    sendUserMessage: vi.fn(),
  } as unknown as ExtensionAPI;
}

describe('extension smoke tests', () => {
  it('exports a default function', () => {
    expect(typeof extension).toBe('function');
  });

  it('wires up without crashing', () => {
    const mockPi = createMockPi();
    expect(() => extension(mockPi)).not.toThrow();
  });

  it('registers the maestria_subagent tool', () => {
    const mockPi = createMockPi();
    extension(mockPi);

    expect(mockPi.registerTool).toHaveBeenCalledTimes(1);
    const toolDef = (mockPi.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][0];

    // registerTool receives a single object argument with a name property
    if (typeof toolDef === 'object' && toolDef !== null) {
      expect(toolDef).toHaveProperty('name', 'maestria_subagent');
    }
  });

  it('registers all expected mode and workflow commands', () => {
    const mockPi = createMockPi();
    extension(mockPi);

    const commandNames = (mockPi.registerCommand as ReturnType<typeof vi.fn>).mock.calls.map(
      (call: unknown[]) => call[0],
    );

    const expected: string[] = [
      'fein',
      'sonar',
      'blitz',
      'orchestrate',
      'maestria-status',
      'review',
      'restore-model',
    ];

    for (const name of expected) {
      expect(commandNames).toContain(name);
    }

    expect(commandNames.length).toBeGreaterThanOrEqual(expected.length);
  });

  it('registers all expected lifecycle event hooks via pi.on', () => {
    const mockPi = createMockPi();
    extension(mockPi);

    const eventNames = (mockPi.on as ReturnType<typeof vi.fn>).mock.calls.map(
      (call: unknown[]) => call[0],
    );

    const expected = [
      'before_agent_start',
      'session_start',
      'session_before_compact',
      'session_before_tree',
      'tool_call',
    ];

    for (const name of expected) {
      expect(eventNames).toContain(name);
    }
  });

  it('registers all expected subagent event subscriptions via pi.events.on', () => {
    const mockPi = createMockPi();
    extension(mockPi);

    const eventNames = (mockPi.events.on as ReturnType<typeof vi.fn>).mock.calls.map(
      (call: unknown[]) => call[0],
    );

    const expected = [
      'subagents:started',
      'subagents:completed',
      'subagents:failed',
      'subagents:steered',
    ];

    for (const name of expected) {
      expect(eventNames).toContain(name);
    }
  });
});
