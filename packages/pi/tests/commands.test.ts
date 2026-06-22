import { describe, it, expect, vi } from 'vite-plus/test';
import { installCommands } from '../src/commands.js';
import { createInitialState } from '../src/state.js';
import type { MaestriaState } from '../src/state.js';

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
  it('registers all four commands', () => {
    const pi = createMockPi();
    const state = createInitialState();
    installCommands(pi as any, state);

    const registeredNames = (pi.registerCommand.mock.calls as Array<[string, unknown]>).map(
      (c) => c[0],
    );
    expect(registeredNames).toContain('orchestrate');
    expect(registeredNames).toContain('maestria-status');
    expect(registeredNames).toContain('review');
    expect(registeredNames).toContain('restore-model');
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
});

describe('/orchestrate command', () => {
  it('restores original model and tools when exiting review mode', async () => {
    const pi = createMockPi();
    const state: MaestriaState = {
      ...createInitialState(),
      reviewMode: true,
      originalModel: 'gpt-4o',
      originalTools: ['read', 'grep', 'bash', 'edit'],
    };
    installCommands(pi as any, state);

    const handler = getHandler(pi, 'orchestrate')!;
    const ctx = createMockCtx({
      modelRegistry: {
        getAll: vi.fn().mockReturnValue([{ id: 'gpt-4o', name: 'GPT-4o' }]),
      },
    });
    await handler('build feature', ctx);

    // Should restore tools
    expect(pi.setActiveTools).toHaveBeenCalledWith(['read', 'grep', 'bash', 'edit']);
    // Should restore model
    expect(pi.setModel).toHaveBeenCalled();
    // Should clear review mode
    expect(state.reviewMode).toBe(false);
    expect(state.originalModel).toBeNull();
    expect(state.originalTools).toBeNull();
  });

  it('clears review mode even when no originals were saved', async () => {
    const pi = createMockPi();
    const state: MaestriaState = {
      ...createInitialState(),
      reviewMode: true,
      originalModel: null,
      originalTools: null,
    };
    installCommands(pi as any, state);

    const handler = getHandler(pi, 'orchestrate')!;
    const ctx = createMockCtx();
    await handler('quick task', ctx);

    // setActiveTools should NOT have been called (no original tools to restore)
    // but we also shouldn't pass null/empty
    expect(state.reviewMode).toBe(false);
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
});
