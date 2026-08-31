import { describe, expect, it, vi } from 'vite-plus/test';

import packageJson from '../package.json';
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
  events: { on: ReturnType<typeof vi.fn<() => void>> };
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
  events: { on: vi.fn<() => void>() },
  getActiveTools: vi.fn<() => string[]>(() => []),
  on: vi.fn<MockOn>(),
  registerCommand: vi.fn<MockCommandRegistration>(),
  registerTool: vi.fn<MockToolRegistration>(),
  sendUserMessage: vi.fn<(text: string, options?: unknown) => void>(),
  setActiveTools: vi.fn<(tools: string[]) => void>(),
  setModel: vi.fn<(model: unknown) => Promise<boolean>>(),
  zod: createMockZod(),
});

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
    const toolCall = mockPi.registerTool.mock.calls.at(0);
    if (toolCall === undefined) {
      throw new Error('maestria_subagent tool was not registered');
    }
    const [toolDef] = toolCall;

    // registerTool receives a single object argument with a name property
    if (typeof toolDef === 'object' && toolDef !== null) {
      expect(toolDef).toHaveProperty('name', 'maestria_subagent');
    }
  });

  it('registers all expected mode and workflow commands', () => {
    const mockPi = createMockPi();
    invokeExtension(mockPi);

    const commandNames = mockPi.registerCommand.mock.calls.map((call: unknown[]) => call[0]);

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

    const eventNames = mockPi.on.mock.calls.map((call: unknown[]) => call[0]);

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

  it('does not subscribe to subagent lifecycle events (omp uses native task tool)', () => {
    const mockPi = createMockPi();
    invokeExtension(mockPi);

    // omp subagent does not subscribe to subagent lifecycle events since it
    // uses the built-in task tool instead of pi-subagents.
    expect(mockPi.events.on).not.toHaveBeenCalled();
  });
});

describe('package.json metadata', () => {
  it('has publishConfig.provenance set to true', () => {
    expect(packageJson.publishConfig?.provenance).toBe(true);
  });

  it('has omp-package keyword for npm discoverability', () => {
    expect(packageJson.keywords).toBeDefined();
    expect(packageJson.keywords).toContain('omp-package');
  });
});
