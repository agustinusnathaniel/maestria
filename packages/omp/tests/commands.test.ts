import { describe, it, expect, vi } from 'vite-plus/test';
import { installCommands } from '@/commands.js';
import { MAESTRIA_EVENTS } from '@/subagent.js';
import { createInitialState } from '@/state.js';
import type { MaestriaState } from '@/state.js';

function createMockPi() {
  return {
    registerCommand: vi.fn(),
    getActiveTools: vi
      .fn()
      .mockReturnValue(['read', 'grep', 'bash', 'edit', 'write', 'find', 'ls']),
    setActiveTools: vi.fn(),
    setModel: vi.fn().mockResolvedValue(true),
    sendUserMessage: vi.fn(),
    appendEntry: vi.fn(),
  };
}

function createMockCtx(overrides: Record<string, unknown> = {}) {
  const mockModel = {
    id: 'claude-sonnet-4-20250514',
    name: 'Claude 4 Sonnet',
    provider: 'anthropic',
  };
  return {
    ui: { notify: vi.fn(), setEditorText: vi.fn() },
    model: mockModel,
    modelRegistry: {
      getAll: vi.fn().mockReturnValue([mockModel]),
    },
    ...overrides,
  };
}

/** Find a command handler registered with pi.registerCommand. */
function getHandler(
  pi: any,
  name: string,
): ((args: string, ctx: any) => Promise<void>) | undefined {
  const calls: Array<[string, unknown]> = pi.registerCommand.mock.calls;
  const match = calls.find((c) => c[0] === name);
  if (!match) return undefined;
  const opts = match[1] as Record<string, unknown>;
  return typeof opts.handler === 'function'
    ? (opts.handler as (args: string, ctx: any) => Promise<void>)
    : undefined;
}

describe('installCommands', () => {
  it('registers all six commands', () => {
    const pi = createMockPi();
    const state = createInitialState();
    installCommands(pi as any, state);

    const registeredNames = (pi.registerCommand.mock.calls as Array<[string, unknown]>).map(
      (c) => c[0],
    );
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
    installCommands(pi as any, state);

    const handler = getHandler(pi, 'review')!;
    const ctx = createMockCtx();
    await handler('review this feature', ctx);

    expect(state.originalModel).toBe('claude-sonnet-4-20250514');
    expect(state.originalTools).toEqual(['read', 'grep', 'bash', 'edit', 'write', 'find', 'ls']);
    expect(state.reviewMode).toBe(true);
  });

  it('restricts to read-only tools when entering review mode', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    installCommands(pi as any, state);

    const handler = getHandler(pi, 'review')!;
    const ctx = createMockCtx();
    await handler('review code quality', ctx);

    expect(pi.setActiveTools).toHaveBeenCalled();
    const toolsArg = pi.setActiveTools.mock.calls[0][0] as string[];

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
    installCommands(pi as any, state);

    const handler = getHandler(pi, 'review')!;
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
    installCommands(pi as any, state);

    const handler = getHandler(pi, 'review')!;
    const ctx = createMockCtx();
    await handler('', ctx);

    expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('Usage: /review'));
    expect(state.reviewMode).toBe(false);
  });

  it('handles null model gracefully', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    installCommands(pi as any, state);

    const handler = getHandler(pi, 'review')!;
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
    installCommands(pi as any, state);

    const handler = getHandler(pi, 'review')!;
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
    const pi = { ...createMockPi(), events: { emit: vi.fn() } };
    const state: MaestriaState = {
      ...createInitialState(),
      reviewModel: 'gpt-4o',
    };
    installCommands(pi as any, state);

    const handler = getHandler(pi, 'review')!;
    const ctx = createMockCtx({
      modelRegistry: {
        getAll: vi.fn().mockReturnValue([{ id: 'claude-sonnet-4-20250514' }, { id: 'gpt-4o' }]),
      },
    });
    await handler('review code', ctx);

    expect(pi.events.emit).toHaveBeenCalledWith(
      MAESTRIA_EVENTS.REVIEW_ACTIVATED,
      expect.objectContaining({
        originalModel: 'claude-sonnet-4-20250514',
        reviewModel: 'gpt-4o',
        timestamp: expect.any(Number),
      }),
    );
  });
});

describe('/restore-model command', () => {
  it('restores original model and tools when in review mode', async () => {
    const pi = createMockPi();
    const state: MaestriaState = {
      ...createInitialState(),
      reviewMode: true,
      originalModel: 'claude-sonnet-4-20250514',
      originalTools: ['read', 'grep', 'bash', 'edit'],
    };
    installCommands(pi as any, state);

    const handler = getHandler(pi, 'restore-model')!;
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
    installCommands(pi as any, state);

    const handler = getHandler(pi, 'restore-model')!;
    const ctx = createMockCtx();
    await handler('', ctx);

    expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('Not in review mode'));
    expect(state.reviewMode).toBe(false);
  });

  it('persists state via appendEntry after restoring model', async () => {
    const pi = createMockPi();
    const state: MaestriaState = {
      ...createInitialState(),
      reviewMode: true,
      originalModel: 'claude-sonnet-4-20250514',
      originalTools: ['read', 'grep', 'bash', 'edit'],
    };
    installCommands(pi as any, state);

    const handler = getHandler(pi, 'restore-model')!;
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
    const pi = { ...createMockPi(), events: { emit: vi.fn() } };
    const state: MaestriaState = {
      ...createInitialState(),
      reviewMode: true,
      originalModel: 'claude-sonnet-4-20250514',
      originalTools: ['read', 'grep', 'bash', 'edit'],
    };
    installCommands(pi as any, state);

    const handler = getHandler(pi, 'restore-model')!;
    const ctx = createMockCtx({
      modelRegistry: {
        getAll: vi.fn().mockReturnValue([{ id: 'claude-sonnet-4-20250514' }]),
      },
    });
    await handler('', ctx);

    expect(pi.events.emit).toHaveBeenCalledWith(
      MAESTRIA_EVENTS.REVIEW_DEACTIVATED,
      expect.objectContaining({
        originalModel: 'claude-sonnet-4-20250514',
        timestamp: expect.any(Number),
      }),
    );
  });
});

describe('/review-model command', () => {
  it('sets reviewModel and persists state', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    installCommands(pi as any, state);

    const handler = getHandler(pi, 'review-model')!;
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
    installCommands(pi as any, state);

    const handler = getHandler(pi, 'review-model')!;
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
    installCommands(pi as any, state);

    const handler = getHandler(pi, 'review-model')!;
    const ctx = createMockCtx();
    await handler('', ctx);

    expect(state.reviewModel).toBeNull();
    expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('Usage: /review-model'));
  });
});

describe('/handoff command', () => {
  it('generates structured prompt with all 6 field headers', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    installCommands(pi as any, state);

    const handler = getHandler(pi, 'handoff')!;
    const ctx = createMockCtx();
    await handler('implement login feature', ctx);

    const prompt = pi.sendUserMessage.mock.calls[0][0] as string;
    expect(prompt).toContain('**Goal:**');
    expect(prompt).toContain('**Context:**');
    expect(prompt).toContain('**Requirements:**');
    expect(prompt).toContain('**Known problems:**');
    expect(prompt).toContain('**Success criteria:**');
    expect(prompt).toContain('**Next step:**');
  });

  it('shows usage for empty args', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    installCommands(pi as any, state);

    const handler = getHandler(pi, 'handoff')!;
    const ctx = createMockCtx();
    await handler('', ctx);

    expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('Usage: /handoff'));
  });

  it('records handoff in state and persists via appendEntry', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    installCommands(pi as any, state);

    const handler = getHandler(pi, 'handoff')!;
    const ctx = createMockCtx();
    await handler('refactor auth module', ctx);

    expect(state.handoffHistory).toHaveLength(1);
    expect(state.handoffHistory[0].from).toBe('current');
    expect(state.handoffHistory[0].to).toBe('next');
    expect(state.handoffHistory[0].task).toBe('refactor auth module');
    expect(state.handoffHistory[0].timestamp).toEqual(expect.any(Number));

    expect(pi.appendEntry).toHaveBeenCalledWith(
      'maestria_state',
      expect.objectContaining({
        handoffHistory: expect.arrayContaining([
          expect.objectContaining({ task: 'refactor auth module' }),
        ]),
      }),
    );
  });

  it('calls sendUserMessage with steer delivery', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    installCommands(pi as any, state);

    const handler = getHandler(pi, 'handoff')!;
    const ctx = createMockCtx();
    await handler('bump dependencies', ctx);

    expect(pi.sendUserMessage).toHaveBeenCalledWith(expect.any(String), { deliverAs: 'steer' });
  });

  it('includes state context in prompt', async () => {
    const pi = createMockPi();
    const state: MaestriaState = {
      ...createInitialState(),
      mode: 'fein',
      activeTask: 'design API',
      blockers: ['missing auth spec', 'performance concerns'],
    };
    installCommands(pi as any, state);

    const handler = getHandler(pi, 'handoff')!;
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
