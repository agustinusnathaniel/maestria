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
    const result = await handler({ input: { command: 'rm -rf /var' }, toolName: 'bash' }, {});
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
    const result = await handler({ input: { command: 'ls -la' }, toolName: 'bash' }, {});
    expect(result).toBeUndefined();
  });

  // ── Dispatcher enforcement tests ──

  it('allows any tool when mode is null (no dispatcher enforcement)', async () => {
    const pi = { getActiveTools: vi.fn(), on: vi.fn() };
    const state = createInitialState(); // mode defaults to null
    installToolInterceptors(pi as any, state);

    const handler = (pi as any).on.mock.calls[0][1];
    const result = await handler({ toolName: 'bash' }, {});
    expect(result).toBeUndefined();
  });

  it('blocks mutation bash when orchestrator is in a mode', async () => {
    const pi = { getActiveTools: vi.fn(), on: vi.fn() };
    pi.getActiveTools.mockReturnValue(['task', 'read', 'write', 'bash']);
    const state = { ...createInitialState(), mode: 'fein' as const };
    installToolInterceptors(pi as any, state);

    const handler = (pi as any).on.mock.calls[0][1];
    const result = await handler({ input: { command: 'rm -rf dist' }, toolName: 'bash' }, {});
    expect(result.block).toBe(true);
    expect(result.reason).toContain("'bash' is blocked");
  });

  it('blocks edit and write when orchestrator is in a mode', async () => {
    const pi = { getActiveTools: vi.fn(), on: vi.fn() };
    pi.getActiveTools.mockReturnValue(['task', 'read', 'write', 'bash']);
    const state = { ...createInitialState(), mode: 'fein' as const };
    installToolInterceptors(pi as any, state);

    const handler = (pi as any).on.mock.calls[0][1];
    expect((await handler({ input: { path: 'a.ts' }, toolName: 'write' }, {})).block).toBe(true);
    expect((await handler({ input: { path: 'a.ts' }, toolName: 'edit' }, {})).block).toBe(true);
  });

  it('allows read-only bash when orchestrator is in a mode', async () => {
    const pi = { getActiveTools: vi.fn(), on: vi.fn() };
    pi.getActiveTools.mockReturnValue(['task', 'read', 'write', 'bash']);
    const state = { ...createInitialState(), mode: 'fein' as const };
    installToolInterceptors(pi as any, state);

    const handler = (pi as any).on.mock.calls[0][1];
    const result = await handler({ input: { command: 'git status' }, toolName: 'bash' }, {});
    expect(result).toBeUndefined();
  });

  it('blocks chained bash that hides a mutation behind a read-only prefix', async () => {
    const pi = { getActiveTools: vi.fn(), on: vi.fn() };
    pi.getActiveTools.mockReturnValue(['task', 'read', 'write', 'bash']);
    const state = { ...createInitialState(), mode: 'fein' as const };
    installToolInterceptors(pi as any, state);

    const handler = (pi as any).on.mock.calls[0][1];
    const result = await handler(
      { input: { command: 'git status && git checkout .' }, toolName: 'bash' },
      {},
    );
    expect(result.block).toBe(true);
  });

  it('blocks command substitution in bash when orchestrator is in a mode', async () => {
    const pi = { getActiveTools: vi.fn(), on: vi.fn() };
    pi.getActiveTools.mockReturnValue(['task', 'read', 'write', 'bash']);
    const state = { ...createInitialState(), mode: 'fein' as const };
    installToolInterceptors(pi as any, state);

    const handler = (pi as any).on.mock.calls[0][1];
    const result = await handler({ input: { command: 'ls $(rm -rf dist)' }, toolName: 'bash' }, {});
    expect(result.block).toBe(true);
  });

  it('allows read-only bash pipelines when orchestrator is in a mode', async () => {
    const pi = { getActiveTools: vi.fn(), on: vi.fn() };
    pi.getActiveTools.mockReturnValue(['task', 'read', 'write', 'bash']);
    const state = { ...createInitialState(), mode: 'fein' as const };
    installToolInterceptors(pi as any, state);

    const handler = (pi as any).on.mock.calls[0][1];
    const result = await handler(
      { input: { command: 'git log --oneline | head -5' }, toolName: 'bash' },
      {},
    );
    expect(result).toBeUndefined();
  });

  it('allows read and grep when orchestrator is in a mode', async () => {
    const pi = { appendEntry: vi.fn(), getActiveTools: vi.fn(), on: vi.fn() };
    pi.getActiveTools.mockReturnValue(['task', 'read', 'write', 'bash']);
    const state = { ...createInitialState(), mode: 'fein' as const };
    installToolInterceptors(pi as any, state);

    const handler = (pi as any).on.mock.calls[0][1];
    expect(await handler({ input: { path: 'a.ts' }, toolName: 'read' }, {})).toBeUndefined();
    expect(await handler({ input: { pattern: 'x' }, toolName: 'grep' }, {})).toBeUndefined();
  });

  it('allows task tool when orchestrator is in a mode', async () => {
    const pi = { getActiveTools: vi.fn(), on: vi.fn() };
    pi.getActiveTools.mockReturnValue(['task', 'read', 'write']);
    const state = { ...createInitialState(), mode: 'fein' as const };
    installToolInterceptors(pi as any, state);

    const handler = (pi as any).on.mock.calls[0][1];
    const result = await handler({ toolName: 'task' }, {});
    expect(result).toBeUndefined();
  });

  it('allows maestria_subagent tool when orchestrator is in a mode', async () => {
    const pi = { getActiveTools: vi.fn(), on: vi.fn() };
    pi.getActiveTools.mockReturnValue(['task', 'read', 'write']);
    const state = { ...createInitialState(), mode: 'fein' as const };
    installToolInterceptors(pi as any, state);

    const handler = (pi as any).on.mock.calls[0][1];
    const result = await handler({ toolName: 'maestria_subagent' }, {});
    expect(result).toBeUndefined();
  });

  it('bypasses dispatcher enforcement when active tools lack task (subagent session)', async () => {
    const pi = { getActiveTools: vi.fn(), on: vi.fn() };
    pi.getActiveTools.mockReturnValue(['read', 'write', 'bash']);
    const state = { ...createInitialState(), mode: 'fein' as const };
    installToolInterceptors(pi as any, state);

    const handler = (pi as any).on.mock.calls[0][1];
    const result = await handler({ toolName: 'bash' }, {});
    expect(result).toBeUndefined();
  });

  it('blocks model goal calls while native goal mode is active when provenance is unavailable', async () => {
    const pi = { getActiveTools: vi.fn(), on: vi.fn() };
    pi.getActiveTools.mockReturnValue(['task', 'goal', 'read', 'write']);
    const state = { ...createInitialState(), mode: 'fein' as const };
    installToolInterceptors(pi as any, state);

    const handler = (pi as any).on.mock.calls[0][1];
    const result = await handler({ toolName: 'goal' }, {});
    expect(result.block).toBe(true);
    expect(result.reason).toContain("'goal' is blocked");
  });

  it('blocks native goal tool when native goal mode is inactive', async () => {
    const pi = { getActiveTools: vi.fn(), on: vi.fn() };
    pi.getActiveTools.mockReturnValue(['task', 'read', 'write']);
    const state = { ...createInitialState(), mode: 'fein' as const };
    installToolInterceptors(pi as any, state);

    const handler = (pi as any).on.mock.calls[0][1];
    const result = await handler({ toolName: 'goal' }, {});
    expect(result.block).toBe(true);
    expect(result.reason).toContain("'goal' is blocked");
  });

  it('still blocks non-goal tools while native goal mode is active', async () => {
    const pi = { getActiveTools: vi.fn(), on: vi.fn() };
    pi.getActiveTools.mockReturnValue(['task', 'goal', 'read', 'write']);
    const state = { ...createInitialState(), mode: 'fein' as const };
    installToolInterceptors(pi as any, state);

    const handler = (pi as any).on.mock.calls[0][1];
    const result = await handler({ toolName: 'write' }, {});
    expect(result.block).toBe(true);
  });

  describe('file tracking', () => {
    it('records file read into state on read tool call', async () => {
      const pi = { appendEntry: vi.fn(), on: vi.fn() };
      const state = createInitialState();
      installToolInterceptors(pi as any, state);

      const handler = (pi as any).on.mock.calls[0][1];
      const result = await handler({ input: { path: 'src/foo.ts' }, toolName: 'read' }, {});
      expect(result).toBeUndefined();
      expect(state.filesRead).toContain('src/foo.ts');
    });

    it('records file modified on edit tool call', async () => {
      const pi = { appendEntry: vi.fn(), on: vi.fn() };
      const state = createInitialState();
      installToolInterceptors(pi as any, state);

      const handler = (pi as any).on.mock.calls[0][1];
      await handler({ input: { edits: [], path: 'src/bar.ts' }, toolName: 'edit' }, {});
      expect(state.filesModified).toContain('src/bar.ts');
    });

    it('records file modified on write tool call', async () => {
      const pi = { appendEntry: vi.fn(), on: vi.fn() };
      const state = createInitialState();
      installToolInterceptors(pi as any, state);

      const handler = (pi as any).on.mock.calls[0][1];
      await handler({ input: { path: 'src/baz.ts' }, toolName: 'write' }, {});
      expect(state.filesModified).toContain('src/baz.ts');
    });

    it('persists state via appendEntry when a file is tracked', async () => {
      const pi = { appendEntry: vi.fn(), on: vi.fn() };
      const state = createInitialState();
      installToolInterceptors(pi as any, state);

      const handler = (pi as any).on.mock.calls[0][1];
      await handler({ input: { path: 'src/foo.ts' }, toolName: 'read' }, {});
      expect(pi.appendEntry).toHaveBeenCalledWith(
        'maestria_state',
        expect.objectContaining({ filesRead: ['src/foo.ts'] }),
      );
    });

    it('does not record when read lacks a path', async () => {
      const pi = { appendEntry: vi.fn(), on: vi.fn() };
      const state = createInitialState();
      installToolInterceptors(pi as any, state);

      const handler = (pi as any).on.mock.calls[0][1];
      await handler({ input: {}, toolName: 'read' }, {});
      expect(state.filesRead).toEqual([]);
      expect(pi.appendEntry).not.toHaveBeenCalled();
    });

    it('does not record blocked edit in review mode', async () => {
      const pi = { appendEntry: vi.fn(), on: vi.fn() };
      const state = { ...createInitialState(), reviewMode: true };
      installToolInterceptors(pi as any, state);

      const handler = (pi as any).on.mock.calls[0][1];
      const result = await handler({ input: { path: 'x.ts' }, toolName: 'edit' }, {});
      expect(result.block).toBe(true);
      expect(state.filesModified).toEqual([]);
    });
  });
});
