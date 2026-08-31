import { MAESTRIA_EVENTS } from '@maestria/shared-pi/subagent-utils';
import { describe, expect, it, vi } from 'vite-plus/test';

import { installCommands } from '@/commands.js';
import { createInitialState } from '@/state.js';
import type { MaestriaState } from '@/state.js';
import type { CommandsCtx, CommandsPi } from '@maestria/shared-pi/commands-core';

type CommandHandler = (args: string, ctx: CommandsCtx) => Promise<void> | void;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

interface MockPi {
  appendEntry: ReturnType<typeof vi.fn<(type: string, data: unknown) => void>>;
  events?: { emit: ReturnType<typeof vi.fn<(event: string, data: unknown) => void>> };
  getActiveTools: ReturnType<typeof vi.fn<() => string[]>>;
  registerCommand: ReturnType<typeof vi.fn<CommandsPi['registerCommand']>>;
  sendUserMessage: ReturnType<
    typeof vi.fn<(content: string | unknown[], options: { deliverAs: string }) => void>
  >;
  setActiveTools: ReturnType<typeof vi.fn<(tools: string[]) => void>>;
  setModel: ReturnType<typeof vi.fn<(model: unknown) => Promise<void>>>;
}

const createMockPi = (): MockPi => ({
  appendEntry: vi.fn<(type: string, data: unknown) => void>(),
  getActiveTools: vi
    .fn<() => string[]>()
    .mockReturnValue(['read', 'grep', 'bash', 'edit', 'write', 'find', 'ls']),
  registerCommand: vi.fn<CommandsPi['registerCommand']>(),
  sendUserMessage: vi.fn<(content: string | unknown[], options: { deliverAs: string }) => void>(),
  setActiveTools: vi.fn<(tools: string[]) => void>(),
  setModel: vi.fn<(model: unknown) => Promise<void>>().mockResolvedValue(),
});

const createMockCtx = (overrides: Partial<CommandsCtx> = {}): CommandsCtx => {
  const mockModel = {
    id: 'claude-sonnet-4-20250514',
    name: 'Claude 4 Sonnet',
    provider: 'anthropic',
  };
  return {
    model: mockModel,
    modelRegistry: {
      getAll: vi.fn<() => { id: string }[]>().mockReturnValue([mockModel]),
    },
    ui: {
      notify: vi.fn<(message: string) => void>(),
      setEditorText: vi.fn<(text: string) => void>(),
    },
    ...overrides,
  };
};

/** Find a command handler registered with pi.registerCommand. */
const getHandler = (pi: MockPi, name: string): CommandHandler | undefined => {
  const match = pi.registerCommand.mock.calls.find(([commandName]) => commandName === name);
  return match?.[1]?.handler;
};

const requireHandler = (pi: MockPi, name: string): CommandHandler => {
  const handler = getHandler(pi, name);
  if (handler === undefined) {
    throw new Error(`Command handler was not registered: ${name}`);
  }
  return handler;
};

describe('installCommands', () => {
  it('registers all six commands', () => {
    const pi = createMockPi();
    const state = createInitialState();
    installCommands(pi, state);

    const registeredNames = pi.registerCommand.mock.calls.map(([name]) => name);
    expect(registeredNames).toContain('maestria-status');
    expect(registeredNames).toContain('review');
    expect(registeredNames).toContain('restore-model');
    expect(registeredNames).toContain('handoff');
    expect(registeredNames).toContain('review-model');
  });
});

describe('/review command', () => {
  it('saves original model and tools before switching', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    installCommands(pi, state);

    const handler = requireHandler(pi, 'review');
    const ctx = createMockCtx();
    await handler('review this feature', ctx);

    expect(state.originalModel).toBe('claude-sonnet-4-20250514');
    expect(state.originalTools).toEqual(['read', 'grep', 'bash', 'edit', 'write', 'find', 'ls']);
    expect(state.reviewMode).toBe(true);
  });

  it('restricts to read-only tools when entering review mode', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    installCommands(pi, state);

    const handler = requireHandler(pi, 'review');
    const ctx = createMockCtx();
    await handler('review code quality', ctx);

    expect(pi.setActiveTools).toHaveBeenCalled();
    const [toolsArg] = pi.setActiveTools.mock.calls[0] ?? [];
    if (toolsArg === undefined) {
      throw new Error('setActiveTools was not called');
    }

    // Should include read-only tools
    expect(toolsArg).toContain('read');
    expect(toolsArg).toContain('grep');
    expect(toolsArg).toContain('find');
    expect(toolsArg).toContain('ls');

    // Should NOT include destructive tools
    expect(toolsArg).not.toContain('edit');
    expect(toolsArg).not.toContain('write');
    expect(toolsArg).not.toContain('bash');
  });

  it('sends a review prompt to the user', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    installCommands(pi, state);

    const handler = requireHandler(pi, 'review');
    const ctx = createMockCtx();
    await handler('audit auth logic', ctx);

    expect(pi.sendUserMessage).toHaveBeenCalledWith(
      expect.stringContaining('[REVIEW: audit auth logic]'),
      { deliverAs: 'steer' },
    );
  });

  it('notifies on empty args', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    installCommands(pi, state);

    const handler = requireHandler(pi, 'review');
    const ctx = createMockCtx();
    await handler('', ctx);

    expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('Usage: /review'));
    expect(state.reviewMode).toBe(false);
  });

  it('handles null model gracefully', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    installCommands(pi, state);

    const handler = requireHandler(pi, 'review');
    const ctx = createMockCtx({ model: undefined });
    await handler('review with no model', ctx);

    expect(state.originalModel).toBeNull();
    expect(state.reviewMode).toBe(true);
  });

  it('cycles to reviewModel when configured', async () => {
    const pi = createMockPi();
    const state: MaestriaState = {
      ...createInitialState(),
      reviewModel: 'gpt-4o',
    };
    installCommands(pi, state);

    const handler = requireHandler(pi, 'review');
    const ctx = createMockCtx({
      modelRegistry: {
        getAll: vi.fn().mockReturnValue([{ id: 'claude-sonnet-4-20250514' }, { id: 'gpt-4o' }]),
      },
    });
    await handler('review code', ctx);

    // Should switch to the review model
    expect(pi.setModel).toHaveBeenCalledWith(expect.objectContaining({ id: 'gpt-4o' }));
    // Should notify about the switch
    expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('switched to gpt-4o'));
  });

  it('emits maestria:review:activated when review model cycles', async () => {
    const pi = {
      ...createMockPi(),
      events: { emit: vi.fn<(event: string, data: unknown) => void>() },
    };
    const state: MaestriaState = {
      ...createInitialState(),
      reviewModel: 'gpt-4o',
    };
    installCommands(pi, state);

    const handler = requireHandler(pi, 'review');
    const ctx = createMockCtx({
      modelRegistry: {
        getAll: vi.fn().mockReturnValue([{ id: 'claude-sonnet-4-20250514' }, { id: 'gpt-4o' }]),
      },
    });
    await handler('review code', ctx);

    const { events } = pi;
    if (events === undefined) {
      throw new Error('review activation event bus was not configured');
    }
    const [eventName, eventData] = events.emit.mock.calls[0] ?? [];
    expect(eventName).toBe(MAESTRIA_EVENTS.REVIEW_ACTIVATED);
    if (!isRecord(eventData)) {
      throw new TypeError('review activation event data was not an object');
    }
    expect(eventData.originalModel).toBe('claude-sonnet-4-20250514');
    expect(eventData.reviewModel).toBe('gpt-4o');
    expect(typeof eventData.timestamp).toBe('number');
  });
});

describe('/restore-model command', () => {
  it('restores original model and tools when in review mode', async () => {
    const pi = createMockPi();
    const state: MaestriaState = {
      ...createInitialState(),
      originalModel: 'claude-sonnet-4-20250514',
      originalTools: ['read', 'grep', 'bash', 'edit'],
      reviewMode: true,
    };
    installCommands(pi, state);

    const handler = requireHandler(pi, 'restore-model');
    const ctx = createMockCtx({
      modelRegistry: {
        getAll: vi
          .fn()
          .mockReturnValue([{ id: 'claude-sonnet-4-20250514', name: 'Claude 4 Sonnet' }]),
      },
    });
    await handler('', ctx);

    expect(pi.setActiveTools).toHaveBeenCalledWith(['read', 'grep', 'bash', 'edit']);
    expect(pi.setModel).toHaveBeenCalled();
    expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('Restored original'));
    expect(state.reviewMode).toBe(false);
  });

  it('notifies when not in review mode', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    installCommands(pi, state);

    const handler = requireHandler(pi, 'restore-model');
    const ctx = createMockCtx();
    await handler('', ctx);

    expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('Not in review mode'));
    expect(state.reviewMode).toBe(false);
  });

  it('persists state via appendEntry after restoring model', async () => {
    const pi = createMockPi();
    const state: MaestriaState = {
      ...createInitialState(),
      originalModel: 'claude-sonnet-4-20250514',
      originalTools: ['read', 'grep', 'bash', 'edit'],
      reviewMode: true,
    };
    installCommands(pi, state);

    const handler = requireHandler(pi, 'restore-model');
    const ctx = createMockCtx({
      modelRegistry: {
        getAll: vi.fn().mockReturnValue([{ id: 'claude-sonnet-4-20250514' }]),
      },
    });
    await handler('', ctx);

    expect(pi.appendEntry).toHaveBeenCalledWith(
      'maestria_state',
      expect.objectContaining({ reviewMode: false }),
    );
  });

  it('emits maestria:review:deactivated after restoration', async () => {
    const pi = {
      ...createMockPi(),
      events: { emit: vi.fn<(event: string, data: unknown) => void>() },
    };
    const state: MaestriaState = {
      ...createInitialState(),
      originalModel: 'claude-sonnet-4-20250514',
      originalTools: ['read', 'grep', 'bash', 'edit'],
      reviewMode: true,
    };
    installCommands(pi, state);

    const handler = requireHandler(pi, 'restore-model');
    const ctx = createMockCtx({
      modelRegistry: {
        getAll: vi.fn().mockReturnValue([{ id: 'claude-sonnet-4-20250514' }]),
      },
    });
    await handler('', ctx);

    const { events } = pi;
    if (events === undefined) {
      throw new Error('review deactivation event bus was not configured');
    }
    const [eventName, eventData] = events.emit.mock.calls[0] ?? [];
    expect(eventName).toBe(MAESTRIA_EVENTS.REVIEW_DEACTIVATED);
    if (!isRecord(eventData)) {
      throw new TypeError('review deactivation event data was not an object');
    }
    expect(eventData.originalModel).toBe('claude-sonnet-4-20250514');
    expect(typeof eventData.timestamp).toBe('number');
  });
});

describe('/review-model command', () => {
  it('sets reviewModel and persists state', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    installCommands(pi, state);

    const handler = requireHandler(pi, 'review-model');
    const ctx = createMockCtx({
      modelRegistry: {
        getAll: vi.fn().mockReturnValue([{ id: 'claude-sonnet-4-20250514' }, { id: 'gpt-4o' }]),
      },
    });
    await handler('gpt-4o', ctx);

    expect(state.reviewModel).toBe('gpt-4o');
    expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('gpt-4o'));
    expect(pi.appendEntry).toHaveBeenCalledWith(
      'maestria_state',
      expect.objectContaining({ reviewModel: 'gpt-4o' }),
    );
  });

  it('shows error for unknown model', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    installCommands(pi, state);

    const handler = requireHandler(pi, 'review-model');
    const ctx = createMockCtx({
      modelRegistry: {
        getAll: vi.fn().mockReturnValue([{ id: 'claude-sonnet-4-20250514' }]),
      },
    });
    await handler('nonexistent', ctx);

    expect(state.reviewModel).toBeNull();
    expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('Unknown model'));
    expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('nonexistent'));
  });

  it('shows usage for empty args', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    installCommands(pi, state);

    const handler = requireHandler(pi, 'review-model');
    const ctx = createMockCtx();
    await handler('', ctx);

    expect(state.reviewModel).toBeNull();
    expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('Usage: /review-model'));
  });
});

describe('/handoff command', () => {
  it('generates structured prompt with all 7 field headers', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    installCommands(pi, state);

    const handler = requireHandler(pi, 'handoff');
    const ctx = createMockCtx();
    await handler('implement login feature', ctx);

    const [prompt] = pi.sendUserMessage.mock.calls[0] ?? [];
    if (typeof prompt !== 'string') {
      throw new TypeError('handoff prompt was not sent');
    }
    expect(prompt).toContain('**Goal:**');
    expect(prompt).toContain('**Context:**');
    expect(prompt).toContain('**Requirements:**');
    expect(prompt).toContain('**Known problems:**');
    expect(prompt).toContain('**Assumptions documented:**');
    expect(prompt).toContain('**Success criteria:**');
    expect(prompt).toContain('**Next step:**');
  });

  it('shows usage for empty args', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    installCommands(pi, state);

    const handler = requireHandler(pi, 'handoff');
    const ctx = createMockCtx();
    await handler('', ctx);

    expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('Usage: /handoff'));
  });

  it('records handoff in state and persists via appendEntry', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    installCommands(pi, state);

    const handler = requireHandler(pi, 'handoff');
    const ctx = createMockCtx();
    await handler('refactor auth module', ctx);

    expect(state.handoffHistory).toHaveLength(1);
    expect(state.handoffHistory[0].from).toBe('current');
    expect(state.handoffHistory[0].to).toBe('next');
    expect(state.handoffHistory[0].task).toBe('refactor auth module');
    const [handoff] = state.handoffHistory;
    if (handoff === undefined) {
      throw new Error('handoff was not recorded');
    }
    expect(typeof handoff.timestamp).toBe('number');

    expect(state.handoffHistory.some(({ task }) => task === 'refactor auth module')).toBe(true);
    expect(pi.appendEntry).toHaveBeenCalledWith('maestria_state', expect.anything());
  });

  it('calls sendUserMessage with steer delivery', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    installCommands(pi, state);

    const handler = requireHandler(pi, 'handoff');
    const ctx = createMockCtx();
    await handler('bump dependencies', ctx);

    expect(pi.sendUserMessage).toHaveBeenCalledWith(expect.any(String), { deliverAs: 'steer' });
  });

  it('includes state context in prompt', async () => {
    const pi = createMockPi();
    const state: MaestriaState = {
      ...createInitialState(),
      activeTask: 'design API',
      blockers: ['missing auth spec', 'performance concerns'],
      mode: 'fein',
    };
    installCommands(pi, state);

    const handler = requireHandler(pi, 'handoff');
    const ctx = createMockCtx();
    await handler('review architecture', ctx);

    expect(pi.sendUserMessage).toHaveBeenCalledWith(
      expect.stringContaining('Mode: fein'),
      expect.objectContaining({ deliverAs: 'steer' }),
    );
    expect(pi.sendUserMessage).toHaveBeenCalledWith(
      expect.stringContaining('Active task: design API'),
      expect.objectContaining({ deliverAs: 'steer' }),
    );
    expect(pi.sendUserMessage).toHaveBeenCalledWith(
      expect.stringContaining('missing auth spec'),
      expect.objectContaining({ deliverAs: 'steer' }),
    );
    expect(pi.sendUserMessage).toHaveBeenCalledWith(
      expect.stringContaining('performance concerns'),
      expect.objectContaining({ deliverAs: 'steer' }),
    );
  });
});
