import { describe, it, expect, vi } from 'vite-plus/test';
import { captureArtifactManifest, installToolInterceptors } from '@/tools.js';
import { createInitialState } from '@/state.js';

describe('installToolInterceptors', () => {
  it('keeps the content manifest stable across staging and commit metadata changes', async () => {
    let files = ['src/file.ts'];
    let contentVersion = 'a';
    const pi = {
      exec: vi.fn(async (_command: string) => ({
        stdout:
          _command === 'find'
            ? `${files.map((file) => `./${file}`).join('\0')}\0`
            : _command === 'git'
              ? contentVersion.repeat(40)
              : '',
        code: 0,
      })),
    };

    const unstaged = await captureArtifactManifest(pi as any);
    const staged = await captureArtifactManifest(pi as any);
    const committed = await captureArtifactManifest(pi as any);
    expect(staged).toEqual(unstaged);
    expect(committed).toEqual(unstaged);

    contentVersion = 'b';
    expect(await captureArtifactManifest(pi as any)).not.toEqual(unstaged);
    files = ['src/file.ts', 'src/added.ts'];
    expect(await captureArtifactManifest(pi as any)).not.toEqual(unstaged);
    expect(pi.exec).not.toHaveBeenCalledWith('git', expect.arrayContaining(['status']));
    expect(pi.exec).not.toHaveBeenCalledWith('git', expect.arrayContaining(['diff']));
  });

  it('fails closed for manifest enumeration and content-hash errors', async () => {
    const pi = {
      exec: vi.fn(async (_command: string) => ({
        stdout: _command === 'find' ? './src/file.ts\0' : '',
        code: _command === 'git' ? 1 : 0,
      })),
    };
    expect(await captureArtifactManifest(pi as any)).toBeUndefined();
  });

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
      const result = await handler({ toolName: 'bash' }, {});
      expect(result).toBeUndefined();
    });

    it('blocks non-maestria_subagent tools when workflow mode is active in orchestrator session', async () => {
      const pi = {
        on: vi.fn(),
        getActiveTools: vi.fn(() => ['subagent', 'read', 'bash']),
        appendEntry: vi.fn(),
      };
      const state = { ...createInitialState(), mode: 'fein' as const };
      installToolInterceptors(pi as any, state);

      const handler = (pi as any).on.mock.calls[0][1];
      const result = await handler({ toolName: 'bash' }, {});
      expect(result.block).toBe(true);
    });

    it('allows maestria_subagent calls when workflow mode is active in orchestrator session', async () => {
      const pi = { on: vi.fn(), getActiveTools: vi.fn(() => ['subagent', 'read', 'bash']) };
      const state = { ...createInitialState(), mode: 'fein' as const };
      installToolInterceptors(pi as any, state);

      const handler = (pi as any).on.mock.calls[0][1];
      const result = await handler({ toolName: 'maestria_subagent' }, {});
      expect(result).toBeUndefined();
    });

    it('does not block when subagent tool is absent (subagent session)', async () => {
      const pi = { on: vi.fn(), getActiveTools: vi.fn(() => ['read', 'bash']) };
      const state = { ...createInitialState(), mode: 'fein' as const };
      installToolInterceptors(pi as any, state);

      const handler = (pi as any).on.mock.calls[0][1];
      const result = await handler({ toolName: 'bash' }, {});
      expect(result).toBeUndefined();
    });

    it('allows direct root tools in blitz mode', async () => {
      const pi = { on: vi.fn(), getActiveTools: vi.fn(() => ['subagent', 'read', 'bash']) };
      const state = { ...createInitialState(), mode: 'blitz' as const };
      installToolInterceptors(pi as any, state);

      const handler = (pi as any).on.mock.calls[0][1];
      const result = await handler({ toolName: 'bash' }, {});
      expect(result).toBeUndefined();
    });

    it('blocks Pi dispatch tools in blitz mode', async () => {
      const pi = { on: vi.fn(), getActiveTools: vi.fn(() => ['subagent', 'read', 'bash']) };
      const state = { ...createInitialState(), mode: 'blitz' as const };
      installToolInterceptors(pi as any, state);

      const handler = (pi as any).on.mock.calls[0][1];
      expect((await handler({ toolName: 'maestria_subagent' }, {})).block).toBe(true);
      expect((await handler({ toolName: 'subagent' }, {})).block).toBe(true);
    });

    it('blocks writes in sonar mode for specialist sessions', async () => {
      const pi = { on: vi.fn(), getActiveTools: vi.fn(() => ['read', 'write', 'bash']) };
      const state = { ...createInitialState(), mode: 'sonar' as const };
      installToolInterceptors(pi as any, state);

      const handler = (pi as any).on.mock.calls[0][1];
      const result = await handler({ toolName: 'write' }, {});
      expect(result.block).toBe(true);
      expect(result.reason).toContain('read-only');
    });
  });

  it('allows only the trusted Pi dispatch surface and blocks shipping before approval', async () => {
    const pi = {
      on: vi.fn(),
      getActiveTools: vi.fn(() => ['subagent', 'read', 'bash']),
      appendEntry: vi.fn(),
    };
    const state = { ...createInitialState(), mode: 'blitz' as const };
    installToolInterceptors(pi as any, state);

    const handler = (pi as any).on.mock.calls[0][1];
    expect(
      await handler(
        { toolName: 'maestria_subagent', input: { agent: 'reviewer', task: 'review' } },
        {},
      ),
    ).toBeUndefined();
    expect(state.landingReview).toBe('execution');
    expect(pi.appendEntry).not.toHaveBeenCalled();
    expect(
      (
        await handler(
          { toolName: 'maestria_subagent', input: { agent: 'builder', task: 'build' } },
          {},
        )
      ).block,
    ).toBe(true);
    expect(
      (
        await handler(
          { toolName: 'subagent', input: { agent: 'reviewer', task: 'review again' } },
          {},
        )
      ).block,
    ).toBe(true);
    expect(
      (await handler({ toolName: 'bash', input: { command: 'git commit -m ship' } }, {})).block,
    ).toBe(true);
    expect(
      (await handler({ toolName: 'bash', input: { command: 'git push origin HEAD' } }, {})).block,
    ).toBe(true);
    expect(
      (await handler({ toolName: 'bash', input: { command: 'gh pr create --fill' } }, {})).block,
    ).toBe(true);
    expect(await handler({ toolName: 'bash', input: { command: 'npm test' } }, {})).toBeUndefined();
    expect(await handler({ toolName: 'edit', input: {} }, {})).toBeUndefined();
  });

  it('does not grant a child session the root reviewer exception', async () => {
    const pi = { on: vi.fn(), getActiveTools: vi.fn(() => ['read', 'write', 'bash']) };
    const state = { ...createInitialState(), mode: 'blitz' as const };
    installToolInterceptors(pi as any, state);

    const handler = (pi as any).on.mock.calls[0][1];
    expect(
      (
        await handler(
          { toolName: 'maestria_subagent', input: { agent: 'reviewer', task: 'review' } },
          {},
        )
      ).block,
    ).toBe(true);
  });
});
