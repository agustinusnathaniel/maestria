import { describe, it, expect, vi } from 'vite-plus/test';
import { installToolInterceptors } from '@/tools.js';
import { createInitialState } from '@/state.js';

describe('installToolInterceptors', () => {
  it('registers a tool_call handler', () => {
    const pi = { on: vi.fn() };
    const state = createInitialState();
    installToolInterceptors(pi as any, state);
    expect(pi.on).toHaveBeenCalledWith('tool_call', expect.any(Function));
  });

  it('blocks edit tools when reviewMode is active', async () => {
    const pi = { on: vi.fn() };
    const state = { ...createInitialState(), reviewMode: true };
    installToolInterceptors(pi as any, state);

    const handler = (pi as any).on.mock.calls[0][1];
    const result = await handler({ toolName: 'edit' }, {});
    expect(result.block).toBe(true);
  });

  it('blocks bash tools when reviewMode is active', async () => {
    const pi = { on: vi.fn() };
    const state = { ...createInitialState(), reviewMode: true };
    installToolInterceptors(pi as any, state);

    const handler = (pi as any).on.mock.calls[0][1];
    const result = await handler({ toolName: 'bash' }, {});
    expect(result.block).toBe(true);
  });

  it('allows tools when reviewMode is inactive', async () => {
    const pi = { on: vi.fn() };
    const state = { ...createInitialState(), reviewMode: false };
    installToolInterceptors(pi as any, state);

    const handler = (pi as any).on.mock.calls[0][1];
    const result = await handler({ toolName: 'edit' }, {});
    expect(result).toBeUndefined();
  });

  it('blocks dangerous bash patterns regardless of review mode', async () => {
    const pi = { on: vi.fn() };
    const state = { ...createInitialState(), reviewMode: false };
    installToolInterceptors(pi as any, state);

    const handler = (pi as any).on.mock.calls[0][1];
    const result = await handler({ toolName: 'bash', input: { command: 'rm -rf /var' } }, {});
    expect(result.block).toBe(true);
  });

  it('allows non-destructive tools in review mode (typed guard distinguishes tools)', async () => {
    const pi = { on: vi.fn() };
    const state = { ...createInitialState(), reviewMode: true };
    installToolInterceptors(pi as any, state);

    const handler = (pi as any).on.mock.calls[0][1];
    const result = await handler({ toolName: 'read' }, {});
    expect(result).toBeUndefined();
  });

  it('allows safe bash commands', async () => {
    const pi = { on: vi.fn() };
    const state = { ...createInitialState(), reviewMode: false };
    installToolInterceptors(pi as any, state);

    const handler = (pi as any).on.mock.calls[0][1];
    const result = await handler({ toolName: 'bash', input: { command: 'ls -la' } }, {});
    expect(result).toBeUndefined();
  });

  describe('dispatcher enforcement', () => {
    it('does not block when mode is null (no workflow)', async () => {
      const pi = { on: vi.fn(), getActiveTools: vi.fn() };
      const state = { ...createInitialState(), mode: null };
      installToolInterceptors(pi as any, state);

      const handler = (pi as any).on.mock.calls[0][1];
      const result = await handler({ toolName: 'bash', input: { command: 'rm -rf x' } }, {});
      expect(result).toBeUndefined();
    });

    it('blocks mutation bash when workflow mode is active in orchestrator session', async () => {
      const pi = {
        on: vi.fn(),
        getActiveTools: vi.fn(() => {
          return ['subagent', 'read', 'bash'];
        }),
      };
      const state = { ...createInitialState(), mode: 'fein' as const };
      installToolInterceptors(pi as any, state);

      const handler = (pi as any).on.mock.calls[0][1];
      const result = await handler({ toolName: 'bash', input: { command: 'rm -rf dist' } }, {});
      expect(result.block).toBe(true);
    });

    it('blocks edit and write when workflow mode is active in orchestrator session', async () => {
      const pi = {
        on: vi.fn(),
        getActiveTools: vi.fn(() => {
          return ['subagent', 'read', 'bash'];
        }),
      };
      const state = { ...createInitialState(), mode: 'fein' as const };
      installToolInterceptors(pi as any, state);

      const handler = (pi as any).on.mock.calls[0][1];
      expect((await handler({ toolName: 'edit', input: { path: 'a.ts' } }, {})).block).toBe(true);
      expect((await handler({ toolName: 'write', input: { path: 'a.ts' } }, {})).block).toBe(true);
    });

    it('allows read-only bash when workflow mode is active in orchestrator session', async () => {
      const pi = {
        on: vi.fn(),
        getActiveTools: vi.fn(() => {
          return ['subagent', 'read', 'bash'];
        }),
      };
      const state = { ...createInitialState(), mode: 'fein' as const };
      installToolInterceptors(pi as any, state);

      const handler = (pi as any).on.mock.calls[0][1];
      const result = await handler({ toolName: 'bash', input: { command: 'git status' } }, {});
      expect(result).toBeUndefined();
    });

    it('blocks chained bash that hides a mutation behind a read-only prefix', async () => {
      const pi = {
        on: vi.fn(),
        getActiveTools: vi.fn(() => {
          return ['subagent', 'read', 'bash'];
        }),
      };
      const state = { ...createInitialState(), mode: 'fein' as const };
      installToolInterceptors(pi as any, state);

      const handler = (pi as any).on.mock.calls[0][1];
      const result = await handler(
        { toolName: 'bash', input: { command: 'git status && git checkout .' } },
        {},
      );
      expect(result.block).toBe(true);
    });

    it('blocks command substitution in bash when workflow mode is active', async () => {
      const pi = {
        on: vi.fn(),
        getActiveTools: vi.fn(() => {
          return ['subagent', 'read', 'bash'];
        }),
      };
      const state = { ...createInitialState(), mode: 'fein' as const };
      installToolInterceptors(pi as any, state);

      const handler = (pi as any).on.mock.calls[0][1];
      const result = await handler(
        { toolName: 'bash', input: { command: 'ls $(rm -rf dist)' } },
        {},
      );
      expect(result.block).toBe(true);
    });

    it('allows read-only bash pipelines when workflow mode is active', async () => {
      const pi = {
        on: vi.fn(),
        getActiveTools: vi.fn(() => {
          return ['subagent', 'read', 'bash'];
        }),
      };
      const state = { ...createInitialState(), mode: 'fein' as const };
      installToolInterceptors(pi as any, state);

      const handler = (pi as any).on.mock.calls[0][1];
      const result = await handler(
        { toolName: 'bash', input: { command: 'git log --oneline | head -5' } },
        {},
      );
      expect(result).toBeUndefined();
    });

    it('allows read-only tools (read, grep) when workflow mode is active in orchestrator session', async () => {
      const pi = {
        on: vi.fn(),
        appendEntry: vi.fn(),
        getActiveTools: vi.fn(() => {
          return ['subagent', 'read', 'bash'];
        }),
      };
      const state = { ...createInitialState(), mode: 'fein' as const };
      installToolInterceptors(pi as any, state);

      const handler = (pi as any).on.mock.calls[0][1];
      const readResult = await handler({ toolName: 'read', input: { path: 'src/a.ts' } }, {});
      expect(readResult).toBeUndefined();
      const grepResult = await handler({ toolName: 'grep', input: { pattern: 'x' } }, {});
      expect(grepResult).toBeUndefined();
    });

    it('allows maestria_subagent calls when workflow mode is active in orchestrator session', async () => {
      const pi = {
        on: vi.fn(),
        getActiveTools: vi.fn(() => {
          return ['subagent', 'read', 'bash'];
        }),
      };
      const state = { ...createInitialState(), mode: 'fein' as const };
      installToolInterceptors(pi as any, state);

      const handler = (pi as any).on.mock.calls[0][1];
      const result = await handler({ toolName: 'maestria_subagent' }, {});
      expect(result).toBeUndefined();
    });

    it('does not block when subagent tool is absent (subagent session)', async () => {
      const pi = {
        on: vi.fn(),
        getActiveTools: vi.fn(() => {
          return ['read', 'bash'];
        }),
      };
      const state = { ...createInitialState(), mode: 'fein' as const };
      installToolInterceptors(pi as any, state);

      const handler = (pi as any).on.mock.calls[0][1];
      const result = await handler({ toolName: 'bash', input: { command: 'rm -rf dist' } }, {});
      expect(result).toBeUndefined();
    });
  });

  describe('file tracking', () => {
    it('records file read into state on read tool call', async () => {
      const pi = { on: vi.fn(), appendEntry: vi.fn() };
      const state = createInitialState();
      installToolInterceptors(pi as any, state);

      const handler = (pi as any).on.mock.calls[0][1];
      const result = await handler({ toolName: 'read', input: { path: 'src/foo.ts' } }, {});
      expect(result).toBeUndefined();
      expect(state.filesRead).toContain('src/foo.ts');
    });

    it('records file modified on edit tool call', async () => {
      const pi = { on: vi.fn(), appendEntry: vi.fn() };
      const state = createInitialState();
      installToolInterceptors(pi as any, state);

      const handler = (pi as any).on.mock.calls[0][1];
      await handler({ toolName: 'edit', input: { path: 'src/bar.ts', edits: [] } }, {});
      expect(state.filesModified).toContain('src/bar.ts');
    });

    it('records file modified on write tool call', async () => {
      const pi = { on: vi.fn(), appendEntry: vi.fn() };
      const state = createInitialState();
      installToolInterceptors(pi as any, state);

      const handler = (pi as any).on.mock.calls[0][1];
      await handler({ toolName: 'write', input: { path: 'src/baz.ts' } }, {});
      expect(state.filesModified).toContain('src/baz.ts');
    });

    it('persists state via appendEntry when a file is tracked', async () => {
      const pi = { on: vi.fn(), appendEntry: vi.fn() };
      const state = createInitialState();
      installToolInterceptors(pi as any, state);

      const handler = (pi as any).on.mock.calls[0][1];
      await handler({ toolName: 'read', input: { path: 'src/foo.ts' } }, {});
      expect(pi.appendEntry).toHaveBeenCalledWith(
        'maestria_state',
        expect.objectContaining({ filesRead: ['src/foo.ts'] }),
      );
    });

    it('does not record when read lacks a path', async () => {
      const pi = { on: vi.fn(), appendEntry: vi.fn() };
      const state = createInitialState();
      installToolInterceptors(pi as any, state);

      const handler = (pi as any).on.mock.calls[0][1];
      await handler({ toolName: 'read', input: {} }, {});
      expect(state.filesRead).toEqual([]);
      expect(pi.appendEntry).not.toHaveBeenCalled();
    });

    it('does not record blocked edit in review mode', async () => {
      const pi = { on: vi.fn(), appendEntry: vi.fn() };
      const state = { ...createInitialState(), reviewMode: true };
      installToolInterceptors(pi as any, state);

      const handler = (pi as any).on.mock.calls[0][1];
      const result = await handler({ toolName: 'edit', input: { path: 'x.ts' } }, {});
      expect(result.block).toBe(true);
      expect(state.filesModified).toEqual([]);
    });
  });
});
