import { describe, expect, it, vi } from 'vite-plus/test';
import type { Mock } from 'vite-plus/test';

import { createInitialState } from '@maestria/shared-pi/state-core';
import type { ModeKeyword } from '@maestria/shared-pi/state-core';
import { installToolInterceptors } from '@/tools.js';
import type { ToolApi } from '@/tools.js';
import type { ToolCallHandler, ToolCallResult } from '@maestria/shared-pi/tools-core';

interface MockPi {
  appendEntry: ReturnType<typeof vi.fn<ToolApi['appendEntry']>>;
  getActiveTools: ReturnType<typeof vi.fn<ToolApi['getActiveTools']>>;
  handlers: ToolCallHandler[];
  on: Mock;
}

const createMockPi = (activeTools: string[] = []): MockPi => {
  const handlers: ToolCallHandler[] = [];
  return {
    appendEntry: vi.fn(),
    getActiveTools: vi.fn(() => activeTools),
    handlers,
    on: vi.fn((_event: string, handler: ToolCallHandler) => {
      handlers.push(handler);
    }),
  };
};

const getHandler = (pi: MockPi): ToolCallHandler => {
  const [handler] = pi.handlers;
  if (handler === undefined) {
    throw new Error('tool_call handler was not registered');
  }
  return handler;
};

const install = (pi: MockPi, state: ReturnType<typeof createInitialState>): void => {
  installToolInterceptors(pi, state);
};

const getBlockedResult = (result: Awaited<ReturnType<ToolCallHandler>>): ToolCallResult => {
  if (result === undefined) {
    throw new Error('expected tool call to be blocked');
  }
  return result;
};

// Guarded git invocations are the only read-only git form under the shared
// bash policy: global safety flags are required and diff/log need patch guards.
const GUARDED_GIT =
  'git --no-pager --no-optional-locks -c core.fsmonitor=false -c core.hooksPath=/dev/null -c log.showSignature=false -c format.pretty=medium';

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
    const result = await handler({ toolName: 'edit' }, {});
    expect(getBlockedResult(result).block).toBe(true);
  });

  it('blocks bash tools when reviewMode is active', async () => {
    const pi = createMockPi();
    const state = { ...createInitialState(), reviewMode: true };
    install(pi, state);

    const handler = getHandler(pi);
    const result = await handler({ toolName: 'bash' }, {});
    expect(getBlockedResult(result).block).toBe(true);
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
    const result = await handler({ input: { command: 'rm -rf /var' }, toolName: 'bash' }, {});
    expect(getBlockedResult(result).block).toBe(true);
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

  describe('dispatcher enforcement', () => {
    it('does not block when mode is null (no workflow)', async () => {
      const pi = createMockPi();
      const state = { ...createInitialState(), mode: null };
      install(pi, state);

      const handler = getHandler(pi);
      const result = await handler({ input: { command: 'rm -rf x' }, toolName: 'bash' }, {});
      expect(result).toBeUndefined();
    });

    it('allows edits, writes, and mutating bash under the full-method and fast modes', async () => {
      await Promise.all(
        (['fein', 'blitz'] as ModeKeyword[]).map(async (mode) => {
          const pi = createMockPi(['subagent', 'read', 'bash']);
          const state = { ...createInitialState(), mode };
          install(pi, state);

          const handler = getHandler(pi);
          const editResult = await handler({ input: { path: 'a.ts' }, toolName: 'edit' }, {});
          expect(editResult).toBeUndefined();
          const writeResult = await handler({ input: { path: 'a.ts' }, toolName: 'write' }, {});
          expect(writeResult).toBeUndefined();
          const bashResult = await handler(
            { input: { command: 'rm -rf dist' }, toolName: 'bash' },
            {},
          );
          expect(bashResult).toBeUndefined();
        }),
      );
    });

    it('blocks edits, writes, and mutating bash under the research-only mode', async () => {
      const mode = 'sonar' as ModeKeyword;
      const pi = createMockPi(['subagent', 'read', 'bash']);
      const state = { ...createInitialState(), mode };
      install(pi, state);

      const handler = getHandler(pi);
      const editResult = await handler({ input: { path: 'a.ts' }, toolName: 'edit' }, {});
      expect(getBlockedResult(editResult).block).toBe(true);
      const writeResult = await handler({ input: { path: 'a.ts' }, toolName: 'write' }, {});
      expect(getBlockedResult(writeResult).block).toBe(true);
      const bashResult = await handler({ input: { command: 'rm -rf dist' }, toolName: 'bash' }, {});
      expect(getBlockedResult(bashResult).block).toBe(true);
    });

    it('allows read-only bash under the research-only mode', async () => {
      const mode = 'sonar' as ModeKeyword;
      const pi = createMockPi(['subagent', 'read', 'bash']);
      const state = { ...createInitialState(), mode };
      install(pi, state);

      const handler = getHandler(pi);
      const result = await handler(
        { input: { command: `${GUARDED_GIT} status --short` }, toolName: 'bash' },
        {},
      );
      expect(result).toBeUndefined();
    });

    it('blocks chained bash that hides a mutation behind a read-only prefix', async () => {
      const mode = 'sonar' as ModeKeyword;
      const pi = createMockPi(['subagent', 'read', 'bash']);
      const state = { ...createInitialState(), mode };
      install(pi, state);

      const handler = getHandler(pi);
      const result = await handler(
        { input: { command: 'git status && git checkout .' }, toolName: 'bash' },
        {},
      );
      expect(getBlockedResult(result).block).toBe(true);
    });

    it('blocks command substitution in bash under the research-only mode', async () => {
      const mode = 'sonar' as ModeKeyword;
      const pi = createMockPi(['subagent', 'read', 'bash']);
      const state = { ...createInitialState(), mode };
      install(pi, state);

      const handler = getHandler(pi);
      const result = await handler(
        { input: { command: 'ls $(rm -rf dist)' }, toolName: 'bash' },
        {},
      );
      expect(getBlockedResult(result).block).toBe(true);
    });

    it('allows read-only bash pipelines under the research-only mode', async () => {
      const mode = 'sonar' as ModeKeyword;
      const pi = createMockPi(['subagent', 'read', 'bash']);
      const state = { ...createInitialState(), mode };
      install(pi, state);

      const handler = getHandler(pi);
      const result = await handler(
        {
          input: {
            command: `${GUARDED_GIT} log --no-ext-diff --no-textconv --oneline | head -5`,
          },
          toolName: 'bash',
        },
        {},
      );
      expect(result).toBeUndefined();
    });

    it('allows read-only tools (read, grep) under the research-only mode', async () => {
      const mode = 'sonar' as ModeKeyword;
      const pi = createMockPi(['subagent', 'read', 'bash']);
      const state = { ...createInitialState(), mode };
      install(pi, state);

      const handler = getHandler(pi);
      const readResult = await handler({ input: { path: 'src/a.ts' }, toolName: 'read' }, {});
      expect(readResult).toBeUndefined();
      const grepResult = await handler({ input: { pattern: 'x' }, toolName: 'grep' }, {});
      expect(grepResult).toBeUndefined();
    });

    it('blocks subagent dispatch under the research-only mode and allows it otherwise', async () => {
      const blockedPi = createMockPi(['subagent', 'read', 'bash']);
      const blockedState = {
        ...createInitialState(),
        mode: 'sonar' as ModeKeyword,
      };
      install(blockedPi, blockedState);

      const blockedHandler = getHandler(blockedPi);
      const blockedResult = await blockedHandler({ toolName: 'subagent' }, {});
      expect(getBlockedResult(blockedResult).block).toBe(true);

      await Promise.all(
        (['fein', 'blitz'] as ModeKeyword[]).map(async (mode) => {
          const pi = createMockPi(['subagent', 'read', 'bash']);
          const state = { ...createInitialState(), mode };
          install(pi, state);

          const handler = getHandler(pi);
          const result = await handler({ toolName: 'subagent' }, {});
          expect(result).toBeUndefined();
        }),
      );

      const unblockedPi = createMockPi(['subagent', 'read', 'bash']);
      const unblockedState = { ...createInitialState(), mode: null };
      install(unblockedPi, unblockedState);

      const unblockedHandler = getHandler(unblockedPi);
      const unblockedResult = await unblockedHandler({ toolName: 'subagent' }, {});
      expect(unblockedResult).toBeUndefined();
    });

    it('allows maestria_subagent calls when no mode blocks them', async () => {
      const pi = createMockPi(['subagent', 'read', 'bash']);
      const state = { ...createInitialState(), mode: 'fein' as const };
      install(pi, state);

      const handler = getHandler(pi);
      const result = await handler({ toolName: 'maestria_subagent' }, {});
      expect(result).toBeUndefined();
    });

    it('does not block mutating bash under the full-method mode when the subagent tool is absent', async () => {
      const pi = createMockPi(['read', 'bash']);
      const state = { ...createInitialState(), mode: 'fein' as const };
      install(pi, state);

      const handler = getHandler(pi);
      const result = await handler({ input: { command: 'rm -rf dist' }, toolName: 'bash' }, {});
      expect(result).toBeUndefined();
    });
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
      const result = await handler({ input: { path: 'x.ts' }, toolName: 'edit' }, {});
      expect(getBlockedResult(result).block).toBe(true);
      expect(state.filesModified).toEqual([]);
    });
  });
});
