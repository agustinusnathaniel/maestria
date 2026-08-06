import { describe, it, expect, vi } from 'vite-plus/test';
import {
  captureArtifactDigest,
  captureArtifactManifest,
  installToolInterceptors,
} from '@/tools.js';
import { createInitialState } from '@/state.js';

describe('installToolInterceptors', () => {
  it('tracks worktree content rather than status, index, or HEAD metadata', async () => {
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
    expect(await captureArtifactManifest(pi as any)).toEqual(unstaged);
    expect(await captureArtifactDigest(pi as any)).toBe(unstaged?.digest);
    contentVersion = 'b';
    expect(await captureArtifactManifest(pi as any)).not.toEqual(unstaged);
    files = ['src/file.ts', 'src/added.ts'];
    expect(await captureArtifactManifest(pi as any)).not.toEqual(unstaged);
    expect(pi.exec).not.toHaveBeenCalledWith('git', expect.arrayContaining(['status']));
    expect(pi.exec).not.toHaveBeenCalledWith('git', expect.arrayContaining(['diff']));
  });

  it('returns no manifest when enumeration or content hashing fails', async () => {
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

  // ── Dispatcher enforcement tests ──

  it('allows any tool when mode is null (no dispatcher enforcement)', async () => {
    const pi = { on: vi.fn(), getActiveTools: vi.fn() };
    const state = createInitialState(); // mode defaults to null
    installToolInterceptors(pi as any, state);

    const handler = (pi as any).on.mock.calls[0][1];
    const result = await handler({ toolName: 'bash' }, {});
    expect(result).toBeUndefined();
  });

  it('blocks tools other than task/maestria_subagent when orchestrator is in a mode', async () => {
    const pi = { on: vi.fn(), getActiveTools: vi.fn() };
    pi.getActiveTools.mockReturnValue(['task', 'read', 'write', 'bash']);
    const state = { ...createInitialState(), mode: 'fein' as const };
    installToolInterceptors(pi as any, state);

    const handler = (pi as any).on.mock.calls[0][1];
    const result = await handler({ toolName: 'bash' }, {});
    expect(result.block).toBe(true);
    expect(result.reason).toContain("'bash' is blocked");
  });

  it('allows task tool when orchestrator is in a mode', async () => {
    const pi = { on: vi.fn(), getActiveTools: vi.fn() };
    pi.getActiveTools.mockReturnValue(['task', 'read', 'write']);
    const state = { ...createInitialState(), mode: 'fein' as const };
    installToolInterceptors(pi as any, state);

    const handler = (pi as any).on.mock.calls[0][1];
    const result = await handler({ toolName: 'task' }, {});
    expect(result).toBeUndefined();
  });

  it('allows maestria_subagent tool when orchestrator is in a mode', async () => {
    const pi = { on: vi.fn(), getActiveTools: vi.fn() };
    pi.getActiveTools.mockReturnValue(['task', 'read', 'write']);
    const state = { ...createInitialState(), mode: 'fein' as const };
    installToolInterceptors(pi as any, state);

    const handler = (pi as any).on.mock.calls[0][1];
    const result = await handler({ toolName: 'maestria_subagent' }, {});
    expect(result.block).toBe(true);
  });

  it('bypasses dispatcher enforcement when active tools lack task (subagent session)', async () => {
    const pi = { on: vi.fn(), getActiveTools: vi.fn() };
    pi.getActiveTools.mockReturnValue(['read', 'write', 'bash']);
    const state = { ...createInitialState(), mode: 'fein' as const };
    installToolInterceptors(pi as any, state);

    const handler = (pi as any).on.mock.calls[0][1];
    const result = await handler({ toolName: 'bash' }, {});
    expect(result).toBeUndefined();
  });

  it('blocks model goal calls while native goal mode is active when provenance is unavailable', async () => {
    const pi = { on: vi.fn(), getActiveTools: vi.fn() };
    pi.getActiveTools.mockReturnValue(['task', 'goal', 'read', 'write']);
    const state = { ...createInitialState(), mode: 'fein' as const };
    installToolInterceptors(pi as any, state);

    const handler = (pi as any).on.mock.calls[0][1];
    const result = await handler({ toolName: 'goal' }, {});
    expect(result.block).toBe(true);
    expect(result.reason).toContain("'goal' is blocked");
  });

  it('blocks native goal tool when native goal mode is inactive', async () => {
    const pi = { on: vi.fn(), getActiveTools: vi.fn() };
    pi.getActiveTools.mockReturnValue(['task', 'read', 'write']);
    const state = { ...createInitialState(), mode: 'fein' as const };
    installToolInterceptors(pi as any, state);

    const handler = (pi as any).on.mock.calls[0][1];
    const result = await handler({ toolName: 'goal' }, {});
    expect(result.block).toBe(true);
    expect(result.reason).toContain("'goal' is blocked");
  });

  it('still blocks non-goal tools while native goal mode is active', async () => {
    const pi = { on: vi.fn(), getActiveTools: vi.fn() };
    pi.getActiveTools.mockReturnValue(['task', 'goal', 'read', 'write']);
    const state = { ...createInitialState(), mode: 'fein' as const };
    installToolInterceptors(pi as any, state);

    const handler = (pi as any).on.mock.calls[0][1];
    const result = await handler({ toolName: 'write' }, {});
    expect(result.block).toBe(true);
  });

  it('allows direct root tools in blitz mode', async () => {
    const pi = { on: vi.fn(), getActiveTools: vi.fn() };
    pi.getActiveTools.mockReturnValue(['task', 'read', 'write', 'bash']);
    const state = { ...createInitialState(), mode: 'blitz' as const };
    installToolInterceptors(pi as any, state);

    const handler = (pi as any).on.mock.calls[0][1];
    const result = await handler({ toolName: 'bash' }, {});
    expect(result).toBeUndefined();
  });

  it('blocks OMP dispatch tools in blitz mode', async () => {
    const pi = { on: vi.fn(), getActiveTools: vi.fn() };
    pi.getActiveTools.mockReturnValue(['task', 'read', 'write', 'bash']);
    const state = { ...createInitialState(), mode: 'blitz' as const };
    installToolInterceptors(pi as any, state);

    const handler = (pi as any).on.mock.calls[0][1];
    expect((await handler({ toolName: 'task' }, {})).block).toBe(true);
    expect((await handler({ toolName: 'maestria_subagent' }, {})).block).toBe(true);
  });

  it('blocks writes in sonar mode for specialist sessions', async () => {
    const pi = { on: vi.fn(), getActiveTools: vi.fn() };
    pi.getActiveTools.mockReturnValue(['read', 'write', 'bash']);
    const state = { ...createInitialState(), mode: 'sonar' as const };
    installToolInterceptors(pi as any, state);

    const handler = (pi as any).on.mock.calls[0][1];
    const result = await handler({ toolName: 'write' }, {});
    expect(result.block).toBe(true);
    expect(result.reason).toContain('read-only');
  });

  it('keeps OMP landing review fail-closed when ExtensionAPI cannot provide a digest', async () => {
    const pi = {
      on: vi.fn(),
      getActiveTools: vi.fn(() => ['task', 'read', 'write', 'bash']),
      appendEntry: vi.fn(),
    };
    const state = { ...createInitialState(), mode: 'blitz' as const };
    installToolInterceptors(pi as any, state);

    const handler = (pi as any).on.mock.calls[0][1];
    const result = await handler(
      { toolName: 'task', toolCallId: 'review-call', input: { agent: 'reviewer', task: 'review' } },
      {},
    );
    expect(result.block).toBe(true);
    expect(state.landingReview).toBe('failed');
    expect(state.landingReviewFailureReason).toContain('public ExtensionAPI.exec');
    expect(
      (await handler({ toolName: 'task', input: { agent: 'builder', task: 'build' } }, {})).block,
    ).toBe(true);
    expect(
      (
        await handler(
          { toolName: 'maestria_subagent', input: { agent: 'reviewer', task: 'review again' } },
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
    expect((await handler({ toolName: 'bash', input: { command: 'npm test' } }, {})).block).toBe(
      true,
    );
    expect((await handler({ toolName: 'edit', input: {} }, {})).block).toBe(true);
  });

  it('approves only the bound native task result and its unchanged artifact', async () => {
    let contentVersion = 'a';
    const currentBranch = 'feature/review';
    const pi = {
      on: vi.fn(),
      getActiveTools: vi.fn(() => ['task', 'read', 'write', 'bash']),
      appendEntry: vi.fn(),
      exec: vi.fn(async (_command: string, args: string[]) => ({
        stdout:
          _command === 'find'
            ? './src/file.ts\0'
            : args.includes('--show-current')
              ? `${currentBranch}\n`
              : _command === 'git'
                ? contentVersion.repeat(40)
                : '',
        stderr: '',
        code: 0,
        killed: false,
      })),
    };
    const state = { ...createInitialState(), mode: 'blitz' as const };
    installToolInterceptors(pi as any, state);

    const toolCallHandler = (pi as any).on.mock.calls[0][1];
    const toolResultHandler = (pi as any).on.mock.calls[1][1];
    const input: Record<string, unknown> = { agent: 'reviewer', task: 'review' };
    expect(
      await toolCallHandler({ toolName: 'task', toolCallId: 'review-call', input }, {}),
    ).toBeUndefined();
    expect(state.landingReview).toBe('reviewing');
    expect(input.schemaMode).toBe('strict');

    const artifactDigest = await captureArtifactDigest(pi as any);
    await toolResultHandler({
      toolName: 'task',
      toolCallId: 'review-call',
      isError: false,
      details: {
        results: [
          {
            agent: 'reviewer',
            exitCode: 0,
            structuredOutput: {
              status: 'valid',
              data: {
                schema: 'maestria.landing-review.v1',
                verdict: 'approved',
                artifactDigest,
                findings: [],
              },
            },
          },
        ],
      },
    });
    expect(state.landingReview).toBe('approved');
    expect(
      await toolCallHandler({ toolName: 'bash', input: { command: 'git add -A' } }, {}),
    ).toBeUndefined();
    expect(
      await toolCallHandler({ toolName: 'bash', input: { command: 'git commit -m ship' } }, {}),
    ).toBeUndefined();
    contentVersion = 'b';
    expect(
      (
        await toolCallHandler(
          { toolName: 'bash', input: { command: 'git push origin feature' } },
          {},
        )
      ).block,
    ).toBe(true);
    expect(
      await toolResultHandler({
        toolName: 'task',
        toolCallId: 'other-call',
        isError: false,
        details: {},
      }),
    ).toBeUndefined();
  });

  it('does not grant a child session the root reviewer exception', async () => {
    const pi = { on: vi.fn(), getActiveTools: vi.fn(() => ['read', 'write', 'bash']) };
    const state = { ...createInitialState(), mode: 'blitz' as const };
    installToolInterceptors(pi as any, state);

    const handler = (pi as any).on.mock.calls[0][1];
    expect(
      (await handler({ toolName: 'task', input: { agent: 'reviewer', task: 'review' } }, {})).block,
    ).toBe(true);
  });
});
