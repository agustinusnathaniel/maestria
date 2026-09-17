import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vite-plus/test';

import extension from '@/extension.js';

type MockHandler = (...args: unknown[]) => unknown;
type MockOn = (event: string, handler: MockHandler) => void;
type MockCommandRegistration = (name: string, options: unknown) => void;
type MockToolRegistration = (tool: unknown) => void;

interface MockPi {
  appendEntry: ReturnType<typeof vi.fn<(type: string, data?: unknown) => void>>;
  events: { on: ReturnType<typeof vi.fn<MockOn>> };
  getActiveTools: ReturnType<typeof vi.fn<() => string[]>>;
  on: ReturnType<typeof vi.fn<MockOn>>;
  registerCommand: ReturnType<typeof vi.fn<MockCommandRegistration>>;
  registerTool: ReturnType<typeof vi.fn<MockToolRegistration>>;
  sendUserMessage: ReturnType<typeof vi.fn<(text: string, options?: unknown) => void>>;
  setActiveTools: ReturnType<typeof vi.fn<(tools: string[]) => void>>;
  setModel: ReturnType<typeof vi.fn<(model: unknown) => Promise<boolean>>>;
}

const createMockPi = (): MockPi => ({
  appendEntry: vi.fn<(type: string, data?: unknown) => void>(),
  events: { on: vi.fn<MockOn>() },
  getActiveTools: vi.fn<() => string[]>(() => []),
  on: vi.fn<MockOn>(),
  registerCommand: vi.fn<MockCommandRegistration>(),
  registerTool: vi.fn<MockToolRegistration>(),
  sendUserMessage: vi.fn<(text: string, options?: unknown) => void>(),
  setActiveTools: vi.fn<(tools: string[]) => void>(),
  setModel: vi.fn<(model: unknown) => Promise<boolean>>(),
});

const invokeExtension = (pi: MockPi): void => {
  Reflect.apply(extension, undefined, [pi]);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

describe('extension smoke tests', () => {
  it('exports a default function', () => {
    expect(typeof extension).toBe('function');
  });

  it('wires up without crashing', () => {
    const mockPi = createMockPi();
    expect(() => {
      invokeExtension(mockPi);
    }).not.toThrow();
  });

  it('registers the maestria_subagent tool', () => {
    const mockPi = createMockPi();
    invokeExtension(mockPi);

    expect(mockPi.registerTool).toHaveBeenCalledTimes(1);
    const [toolDef] = mockPi.registerTool.mock.calls[0] ?? [];

    // registerTool receives a single object argument with a name property
    if (typeof toolDef === 'object' && toolDef !== null) {
      expect(toolDef).toHaveProperty('name', 'maestria_subagent');
    }
  });

  it('registers all expected mode and workflow commands', () => {
    const mockPi = createMockPi();
    invokeExtension(mockPi);

    const commandNames = mockPi.registerCommand.mock.calls.map(([name]) => name);

    const expected: string[] = [
      'fein',
      'sonar',
      'blitz',
      'maestria-status',
      'review',
      'restore-model',
      'handoff',
      'review-model',
    ];

    for (const name of expected) {
      expect(commandNames).toContain(name);
    }

    expect(commandNames.length).toBeGreaterThanOrEqual(expected.length);
  });

  it('registers all expected lifecycle event hooks via pi.on', () => {
    const mockPi = createMockPi();
    invokeExtension(mockPi);

    const eventNames = mockPi.on.mock.calls.map(([name]) => name);

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
    invokeExtension(mockPi);

    const eventNames = mockPi.events.on.mock.calls.map(([name]) => name);

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

describe('package.json metadata', () => {
  const __dirname = import.meta.dirname;
  const pkgPath = path.join(__dirname, '..', 'package.json');
  const pkgValue: unknown = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  if (!isRecord(pkgValue)) {
    throw new TypeError('package.json did not contain an object');
  }
  const { keywords, publishConfig } = pkgValue;

  it('has publishConfig.provenance set to true', () => {
    expect(isRecord(publishConfig) && publishConfig.provenance).toBe(true);
  });

  it('has pi-package keyword for npm discoverability', () => {
    expect(keywords).toBeDefined();
    if (!Array.isArray(keywords)) {
      throw new TypeError('package.json keywords were not an array');
    }
    expect(keywords).toContain('pi-package');
  });
});
