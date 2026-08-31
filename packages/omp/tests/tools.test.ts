import { describe, expect, it, vi } from 'vite-plus/test';

import { createInitialState } from '@/state.js';
import { installToolInterceptors } from '@/tools.js';
import type { ToolApi, ToolHandler, ToolResult } from '@/tools.js';

interface MockPi {
  appendEntry: ReturnType<typeof vi.fn<ToolApi['appendEntry']>>;
  getActiveTools: ReturnType<typeof vi.fn<ToolApi['getActiveTools']>>;
  handlers: ToolHandler[];
  on: ReturnType<typeof vi.fn<ToolApi['on']>>;
}

const createMockPi = (activeTools: string[] = []): MockPi => {
  const handlers: ToolHandler[] = [];
  return {
    appendEntry: vi.fn(),
    getActiveTools: vi.fn(() => activeTools),
    handlers,
    on: vi.fn((_event: string, handler: ToolHandler) => {
      handlers.push(handler);
    }),
  };
};

const getHandler = (pi: MockPi): ToolHandler => {
  const [handler] = pi.handlers;
  if (handler === undefined) {
    throw new Error('tool_call handler was not registered');
  }
  return handler;
};

const requireBlocked = (result: ToolResult | undefined): ToolResult => {
  if (result?.block !== true) {
    throw new Error('Expected the tool call to be blocked');
  }
  return result;
};

const install = (pi: MockPi, state: ReturnType<typeof createInitialState>): void => {
  installToolInterceptors(pi, state);
};

describe('installToolInterceptors', () => {
  it('registers a tool_call handler', () => {
    const pi = createMockPi();
    const state = createInitialState();
    install(pi, state);
    expect(pi.on).toHaveBeenCalledWith('tool_call', expect.any(Function));
  });

  it('blocks edit tools when reviewMode is active', async () => {
    const pi = createMockPi();
    const state = { ...createInitialState(), reviewMode: true };
    install(pi, state);

    const handler = getHandler(pi);
    const result = requireBlocked(await handler({ toolName: 'edit' }, {}));
    expect(result.block).toBe(true);
  });

  it('blocks bash tools when reviewMode is active', async () => {
    const pi = createMockPi();
    const state = { ...createInitialState(), reviewMode: true };
    install(pi, state);

    const handler = getHandler(pi);
    const result = requireBlocked(await handler({ toolName: 'bash' }, {}));
    expect(result.block).toBe(true);
  });

  it('allows tools when reviewMode is inactive', async () => {
    const pi = createMockPi();
    const state = { ...createInitialState(), reviewMode: false };
    install(pi, state);

    const handler = getHandler(pi);
    const result = await handler({ toolName: 'edit' }, {});
    expect(result).toBeUndefined();
  });

  it('blocks dangerous bash patterns regardless of review mode', async () => {
    const pi = createMockPi();
    const state = { ...createInitialState(), reviewMode: false };
    install(pi, state);

    const handler = getHandler(pi);
    const result = requireBlocked(
      await handler({ input: { command: 'rm -rf /var' }, toolName: 'bash' }, {}),
    );
    expect(result.block).toBe(true);
  });

  it('allows non-destructive tools in review mode (typed guard distinguishes tools)', async () => {
    const pi = createMockPi();
    const state = { ...createInitialState(), reviewMode: true };
    install(pi, state);

    const handler = getHandler(pi);
    const result = await handler({ toolName: 'read' }, {});
    expect(result).toBeUndefined();
  });

  it('allows safe bash commands', async () => {
    const pi = createMockPi();
    const state = { ...createInitialState(), reviewMode: false };
    install(pi, state);

    const handler = getHandler(pi);
    const result = await handler({ input: { command: 'ls -la' }, toolName: 'bash' }, {});
    expect(result).toBeUndefined();
  });

  // ── Dispatcher enforcement tests ──

  it('allows any tool when mode is null (no dispatcher enforcement)', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    install(pi, state);

    const handler = getHandler(pi);
    const result = await handler({ toolName: 'bash' }, {});
    expect(result).toBeUndefined();
  });

  it('blocks mutation bash when orchestrator is in a mode', async () => {
    const pi = createMockPi(['task', 'read', 'write', 'bash']);
    const state = { ...createInitialState(), mode: 'fein' as const };
    install(pi, state);

    const handler = getHandler(pi);
    const result = requireBlocked(
      await handler({ input: { command: 'rm -rf dist' }, toolName: 'bash' }, {}),
    );
    expect(result.block).toBe(true);
    expect(result.reason).toContain("'bash' is blocked");
  });

  it('blocks edit and write when orchestrator is in a mode', async () => {
    const pi = createMockPi(['task', 'read', 'write', 'bash']);
    const state = { ...createInitialState(), mode: 'fein' as const };
    install(pi, state);

    const handler = getHandler(pi);
    const writeResult = requireBlocked(
      await handler({ input: { path: 'a.ts' }, toolName: 'write' }, {}),
    );
    const editResult = requireBlocked(
      await handler({ input: { path: 'a.ts' }, toolName: 'edit' }, {}),
    );
    expect(writeResult.block).toBe(true);
    expect(editResult.block).toBe(true);
  });

  it('allows read-only bash when orchestrator is in a mode', async () => {
    const pi = createMockPi(['task', 'read', 'write', 'bash']);
    const state = { ...createInitialState(), mode: 'fein' as const };
    install(pi, state);

    const handler = getHandler(pi);
    const result = await handler({ input: { command: 'git status' }, toolName: 'bash' }, {});
    expect(result).toBeUndefined();
  });

  it('blocks chained bash that hides a mutation behind a read-only prefix', async () => {
    const pi = createMockPi(['task', 'read', 'write', 'bash']);
    const state = { ...createInitialState(), mode: 'fein' as const };
    install(pi, state);

    const handler = getHandler(pi);
    const result = requireBlocked(
      await handler({ input: { command: 'git status && git checkout .' }, toolName: 'bash' }, {}),
    );
    expect(result.block).toBe(true);
  });

  it('blocks command substitution in bash when orchestrator is in a mode', async () => {
    const pi = createMockPi(['task', 'read', 'write', 'bash']);
    const state = { ...createInitialState(), mode: 'fein' as const };
    install(pi, state);

    const handler = getHandler(pi);
    const result = requireBlocked(
      await handler({ input: { command: 'ls $(rm -rf dist)' }, toolName: 'bash' }, {}),
    );
    expect(result.block).toBe(true);
  });

  it('allows read-only bash pipelines when orchestrator is in a mode', async () => {
    const pi = createMockPi(['task', 'read', 'write', 'bash']);
    const state = { ...createInitialState(), mode: 'fein' as const };
    install(pi, state);

    const handler = getHandler(pi);
    const result = await handler(
      { input: { command: 'git log --oneline | head -5' }, toolName: 'bash' },
      {},
    );
    expect(result).toBeUndefined();
  });

  it('allows read and grep when orchestrator is in a mode', async () => {
    const pi = createMockPi(['task', 'read', 'write', 'bash']);
    const state = { ...createInitialState(), mode: 'fein' as const };
    install(pi, state);

    const handler = getHandler(pi);
    expect(await handler({ input: { path: 'a.ts' }, toolName: 'read' }, {})).toBeUndefined();
    expect(await handler({ input: { pattern: 'x' }, toolName: 'grep' }, {})).toBeUndefined();
  });

  it('allows task tool when orchestrator is in a mode', async () => {
    const pi = createMockPi(['task', 'read', 'write']);
    const state = { ...createInitialState(), mode: 'fein' as const };
    install(pi, state);

    const handler = getHandler(pi);
    const result = await handler({ toolName: 'task' }, {});
    expect(result).toBeUndefined();
  });

  it('allows maestria_subagent tool when orchestrator is in a mode', async () => {
    const pi = createMockPi(['task', 'read', 'write']);
    const state = { ...createInitialState(), mode: 'fein' as const };
    install(pi, state);

    const handler = getHandler(pi);
    const result = await handler({ toolName: 'maestria_subagent' }, {});
    expect(result).toBeUndefined();
  });

  it('bypasses dispatcher enforcement when active tools lack task (subagent session)', async () => {
    const pi = createMockPi(['read', 'write', 'bash']);
    const state = { ...createInitialState(), mode: 'fein' as const };
    install(pi, state);

    const handler = getHandler(pi);
    const result = await handler({ toolName: 'bash' }, {});
    expect(result).toBeUndefined();
  });

  it('blocks model goal calls while native goal mode is active when provenance is unavailable', async () => {
    const pi = createMockPi(['task', 'goal', 'read', 'write']);
    const state = { ...createInitialState(), mode: 'fein' as const };
    install(pi, state);

    const handler = getHandler(pi);
    const result = requireBlocked(await handler({ toolName: 'goal' }, {}));
    expect(result.block).toBe(true);
    expect(result.reason).toContain("'goal' is blocked");
  });

  it('blocks native goal tool when native goal mode is inactive', async () => {
    const pi = createMockPi(['task', 'read', 'write']);
    const state = { ...createInitialState(), mode: 'fein' as const };
    install(pi, state);

    const handler = getHandler(pi);
    const result = requireBlocked(await handler({ toolName: 'goal' }, {}));
    expect(result.block).toBe(true);
    expect(result.reason).toContain("'goal' is blocked");
  });

  it('still blocks non-goal tools while native goal mode is active', async () => {
    const pi = createMockPi(['task', 'goal', 'read', 'write']);
    const state = { ...createInitialState(), mode: 'fein' as const };
    install(pi, state);

    const handler = getHandler(pi);
    const result = requireBlocked(await handler({ toolName: 'write' }, {}));
    expect(result.block).toBe(true);
  });

  describe('file tracking', () => {
    it('records file read into state on read tool call', async () => {
      const pi = createMockPi();
      const state = createInitialState();
      install(pi, state);

      const handler = getHandler(pi);
      const result = await handler({ input: { path: 'src/foo.ts' }, toolName: 'read' }, {});
      expect(result).toBeUndefined();
      expect(state.filesRead).toContain('src/foo.ts');
    });

    it('records file modified on edit tool call', async () => {
      const pi = createMockPi();
      const state = createInitialState();
      install(pi, state);

      const handler = getHandler(pi);
      await handler({ input: { edits: [], path: 'src/bar.ts' }, toolName: 'edit' }, {});
      expect(state.filesModified).toContain('src/bar.ts');
    });

    it('records file modified on write tool call', async () => {
      const pi = createMockPi();
      const state = createInitialState();
      install(pi, state);

      const handler = getHandler(pi);
      await handler({ input: { path: 'src/baz.ts' }, toolName: 'write' }, {});
      expect(state.filesModified).toContain('src/baz.ts');
    });

    it('persists state via appendEntry when a file is tracked', async () => {
      const pi = createMockPi();
      const state = createInitialState();
      install(pi, state);

      const handler = getHandler(pi);
      await handler({ input: { path: 'src/foo.ts' }, toolName: 'read' }, {});
      expect(pi.appendEntry).toHaveBeenCalledWith(
        'maestria_state',
        expect.objectContaining({ filesRead: ['src/foo.ts'] }),
      );
    });

    it('does not record when read lacks a path', async () => {
      const pi = createMockPi();
      const state = createInitialState();
      install(pi, state);

      const handler = getHandler(pi);
      await handler({ input: {}, toolName: 'read' }, {});
      expect(state.filesRead).toEqual([]);
      expect(pi.appendEntry).not.toHaveBeenCalled();
    });

    it('does not record blocked edit in review mode', async () => {
      const pi = createMockPi();
      const state = { ...createInitialState(), reviewMode: true };
      install(pi, state);

      const handler = getHandler(pi);
      const result = requireBlocked(
        await handler({ input: { path: 'x.ts' }, toolName: 'edit' }, {}),
      );
      expect(result.block).toBe(true);
      expect(state.filesModified).toEqual([]);
    });
  });
});
