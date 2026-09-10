import { describe, expect, it, vi } from 'vite-plus/test';

import { installCommands } from '../src/commands-core.js';
import type { CommandsCtx, CommandsPi } from '../src/commands-core.js';
import { createInitialState } from '../src/state-core.js';
import type { MaestriaState } from '../src/state-core.js';
import { MAESTRIA_EVENTS } from '../src/subagent-utils.js';

type CommandHandler = (args: string, ctx: CommandsCtx) => Promise<void> | void;

interface MockPi {
  appendEntry: ReturnType<typeof vi.fn<CommandsPi['appendEntry']>>;
  events: { emit: ReturnType<typeof vi.fn<(event: string, data: unknown) => void>> };
  getActiveTools: ReturnType<typeof vi.fn<CommandsPi['getActiveTools']>>;
  registerCommand: ReturnType<typeof vi.fn<CommandsPi['registerCommand']>>;
  sendUserMessage: ReturnType<typeof vi.fn<CommandsPi['sendUserMessage']>>;
  setActiveTools: ReturnType<typeof vi.fn<CommandsPi['setActiveTools']>>;
  setModel: ReturnType<typeof vi.fn<CommandsPi['setModel']>>;
}

const createMockPi = (): MockPi => ({
  appendEntry: vi.fn<CommandsPi['appendEntry']>(),
  events: { emit: vi.fn<(event: string, data: unknown) => void>() },
  getActiveTools: vi
    .fn<CommandsPi['getActiveTools']>()
    .mockReturnValue(['read', 'grep', 'bash', 'edit', 'write', 'find', 'ls']),
  registerCommand: vi.fn<CommandsPi['registerCommand']>(),
  sendUserMessage: vi.fn<CommandsPi['sendUserMessage']>(),
  setActiveTools: vi.fn<CommandsPi['setActiveTools']>(),
  setModel: vi.fn<CommandsPi['setModel']>().mockResolvedValue(),
});

const createMockCtx = (overrides: Partial<CommandsCtx> = {}): CommandsCtx => {
  const mockModel = { id: 'claude-sonnet-4-20250514', name: 'Claude 4 Sonnet' };
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

const install = (pi: MockPi, state: MaestriaState): void => {
  installCommands(pi, state);
};

describe('installCommands', () => {
  it('registers all five commands', () => {
    const pi = createMockPi();
    install(pi, createInitialState());

    const registeredNames = pi.registerCommand.mock.calls.map(([name]) => name);
    expect(registeredNames).toEqual([
      'maestria-status',
      'review',
      'restore-model',
      'handoff',
      'review-model',
    ]);
  });
});

describe('/maestria-status command', () => {
  it('notifies when there is no state to report', async () => {
    const pi = createMockPi();
    install(pi, createInitialState());

    const ctx = createMockCtx();
    await requireHandler(pi, 'maestria-status')('', ctx);

    expect(ctx.ui.notify).toHaveBeenCalledWith('No active maestria state to report.');
    expect(ctx.ui.setEditorText).not.toHaveBeenCalled();
  });

  it('writes the rendered summary into the editor', async () => {
    const pi = createMockPi();
    const state: MaestriaState = { ...createInitialState(), activeTask: 'ship the feature' };
    install(pi, state);

    const ctx = createMockCtx();
    await requireHandler(pi, 'maestria-status')('', ctx);

    expect(ctx.ui.setEditorText).toHaveBeenCalledWith(expect.stringContaining('ship the feature'));
  });
});

describe('/review command', () => {
  it('saves originals, enables review mode, persists, and restricts tools', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    install(pi, state);

    const ctx = createMockCtx();
    await requireHandler(pi, 'review')('review this feature', ctx);

    expect(state.originalModel).toBe('claude-sonnet-4-20250514');
    expect(state.originalTools).toEqual(['read', 'grep', 'bash', 'edit', 'write', 'find', 'ls']);
    expect(state.reviewMode).toBe(true);
    expect(pi.appendEntry).toHaveBeenCalledWith('maestria_state', expect.anything());

    const [toolsArg] = pi.setActiveTools.mock.calls[0] ?? [];
    if (toolsArg === undefined) {
      throw new Error('setActiveTools was not called');
    }
    expect(toolsArg).toContain('read');
    expect(toolsArg).toContain('grep');
    expect(toolsArg).not.toContain('edit');
    expect(toolsArg).not.toContain('bash');
  });

  it('sends the review prompt with steer delivery', async () => {
    const pi = createMockPi();
    install(pi, createInitialState());

    await requireHandler(pi, 'review')('audit auth logic', createMockCtx());

    expect(pi.sendUserMessage).toHaveBeenCalledWith(
      expect.stringContaining('[REVIEW: audit auth logic]'),
      { deliverAs: 'steer' },
    );
  });

  it('notifies on empty args without enabling review mode', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    install(pi, state);

    const ctx = createMockCtx();
    await requireHandler(pi, 'review')('', ctx);

    expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('Usage: /review'));
    expect(state.reviewMode).toBe(false);
  });

  it('cycles to the configured review model and emits REVIEW_ACTIVATED', async () => {
    const pi = createMockPi();
    const state: MaestriaState = { ...createInitialState(), reviewModel: 'gpt-4o' };
    install(pi, state);

    const ctx = createMockCtx({
      modelRegistry: {
        getAll: vi.fn().mockReturnValue([{ id: 'claude-sonnet-4-20250514' }, { id: 'gpt-4o' }]),
      },
    });
    await requireHandler(pi, 'review')('review code', ctx);

    expect(pi.setModel).toHaveBeenCalledWith(expect.objectContaining({ id: 'gpt-4o' }));
    expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('switched to gpt-4o'));
    expect(pi.events.emit).toHaveBeenCalledWith(
      MAESTRIA_EVENTS.REVIEW_ACTIVATED,
      expect.objectContaining({
        originalModel: 'claude-sonnet-4-20250514',
        reviewModel: 'gpt-4o',
      }),
    );
  });

  it('handles a missing current model', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    install(pi, state);

    await requireHandler(pi, 'review')('review with no model', createMockCtx({ model: undefined }));

    expect(state.originalModel).toBeNull();
    expect(state.reviewMode).toBe(true);
  });
});

describe('/restore-model command', () => {
  it('notifies when review mode is not active', async () => {
    const pi = createMockPi();
    install(pi, createInitialState());

    const ctx = createMockCtx();
    await requireHandler(pi, 'restore-model')('', ctx);

    expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('Not in review mode'));
  });

  it('restores original tools and model, persists, and emits REVIEW_DEACTIVATED', async () => {
    const pi = createMockPi();
    const state: MaestriaState = {
      ...createInitialState(),
      originalModel: 'claude-sonnet-4-20250514',
      originalTools: ['read', 'grep', 'bash', 'edit'],
      reviewMode: true,
    };
    install(pi, state);

    const ctx = createMockCtx({
      modelRegistry: {
        getAll: vi.fn().mockReturnValue([{ id: 'claude-sonnet-4-20250514' }]),
      },
    });
    await requireHandler(pi, 'restore-model')('', ctx);

    expect(pi.setActiveTools).toHaveBeenCalledWith(['read', 'grep', 'bash', 'edit']);
    expect(pi.setModel).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'claude-sonnet-4-20250514' }),
    );
    expect(state.reviewMode).toBe(false);
    expect(state.originalModel).toBeNull();
    expect(state.originalTools).toBeNull();
    expect(pi.appendEntry).toHaveBeenCalledWith(
      'maestria_state',
      expect.objectContaining({ reviewMode: false }),
    );
    expect(pi.events.emit).toHaveBeenCalledWith(
      MAESTRIA_EVENTS.REVIEW_DEACTIVATED,
      expect.objectContaining({ originalModel: 'claude-sonnet-4-20250514' }),
    );
  });
});

describe('/handoff command', () => {
  it('notifies on empty args', async () => {
    const pi = createMockPi();
    install(pi, createInitialState());

    const ctx = createMockCtx();
    await requireHandler(pi, 'handoff')('', ctx);

    expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('Usage: /handoff'));
  });

  it('records the handoff, persists, and sends the structured prompt', async () => {
    const pi = createMockPi();
    const state: MaestriaState = {
      ...createInitialState(),
      activeTask: 'design API',
      blockers: ['missing auth spec'],
      mode: 'fein',
    };
    install(pi, state);

    await requireHandler(pi, 'handoff')('refactor auth module', createMockCtx());

    expect(state.handoffHistory).toHaveLength(1);
    expect(state.handoffHistory[0]).toMatchObject({
      from: 'current',
      task: 'refactor auth module',
      to: 'next',
    });
    expect(pi.appendEntry).toHaveBeenCalledWith('maestria_state', expect.anything());
    expect(pi.sendUserMessage).toHaveBeenCalledWith(
      expect.stringContaining('Mode: fein'),
      expect.objectContaining({ deliverAs: 'steer' }),
    );
    expect(pi.sendUserMessage).toHaveBeenCalledWith(
      expect.stringContaining('missing auth spec'),
      expect.objectContaining({ deliverAs: 'steer' }),
    );
  });
});

describe('/review-model command', () => {
  it('sets and persists a known review model', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    install(pi, state);

    const ctx = createMockCtx({
      modelRegistry: {
        getAll: vi.fn().mockReturnValue([{ id: 'claude-sonnet-4-20250514' }, { id: 'gpt-4o' }]),
      },
    });
    await requireHandler(pi, 'review-model')('gpt-4o', ctx);

    expect(state.reviewModel).toBe('gpt-4o');
    expect(pi.appendEntry).toHaveBeenCalledWith(
      'maestria_state',
      expect.objectContaining({ reviewModel: 'gpt-4o' }),
    );
  });

  it('rejects an unknown model without mutating state', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    install(pi, state);

    const ctx = createMockCtx({
      modelRegistry: { getAll: vi.fn().mockReturnValue([{ id: 'claude-sonnet-4-20250514' }]) },
    });
    await requireHandler(pi, 'review-model')('nonexistent', ctx);

    expect(state.reviewModel).toBeNull();
    expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('Unknown model'));
  });

  it('notifies on empty args', async () => {
    const pi = createMockPi();
    install(pi, createInitialState());

    const ctx = createMockCtx();
    await requireHandler(pi, 'review-model')('', ctx);

    expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('Usage: /review-model'));
  });
});
