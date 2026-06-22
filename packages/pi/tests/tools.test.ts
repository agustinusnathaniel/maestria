import { describe, it, expect, vi } from 'vite-plus/test';
import { installToolInterceptors } from '../src/tools.js';
import { createInitialState } from '../src/state.js';

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
});
