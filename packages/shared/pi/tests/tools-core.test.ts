import { describe, expect, it, vi } from 'vite-plus/test';

import { createInitialState } from '../src/state-core.js';
import {
  createToolCallHandler,
  DANGEROUS_PATTERNS,
  isReadOnlyBashCommand,
} from '../src/tools-core.js';
import type { ToolCallHandlerOptions } from '../src/tools-core.js';

// ── isReadOnlyBashCommand ────────────────────────────────────────────

describe('isReadOnlyBashCommand', () => {
  it('allows plain read-only commands', () => {
    expect(isReadOnlyBashCommand('git status')).toBe(true);
    expect(isReadOnlyBashCommand('git diff --stat')).toBe(true);
    expect(isReadOnlyBashCommand('git log --oneline')).toBe(true);
    expect(isReadOnlyBashCommand('ls -la')).toBe(true);
    expect(isReadOnlyBashCommand('grep -r foo src/')).toBe(true);
    expect(isReadOnlyBashCommand('find . -name "*.ts"')).toBe(true);
    expect(isReadOnlyBashCommand('pwd')).toBe(true);
    expect(isReadOnlyBashCommand('which node')).toBe(true);
  });

  it('allows read-only pipelines and fd redirects', () => {
    expect(isReadOnlyBashCommand('git log --oneline | head -5')).toBe(true);
    expect(isReadOnlyBashCommand('git diff --stat | grep src')).toBe(true);
    expect(isReadOnlyBashCommand('git status 2>&1')).toBe(true);
  });

  it('allows test commands for verification', () => {
    expect(isReadOnlyBashCommand('pnpm test')).toBe(true);
    expect(isReadOnlyBashCommand('pnpm test --run tools')).toBe(true);
    expect(isReadOnlyBashCommand('npm test')).toBe(true);
  });

  it('blocks mutation commands outright', () => {
    expect(isReadOnlyBashCommand('rm -rf dist')).toBe(false);
    expect(isReadOnlyBashCommand('pnpm add lodash')).toBe(false);
    expect(isReadOnlyBashCommand('git checkout -- .')).toBe(false);
    expect(isReadOnlyBashCommand('git push origin main')).toBe(false);
    expect(isReadOnlyBashCommand('git reset --hard')).toBe(false);
  });

  it('blocks chained commands that hide a mutation after a read-only prefix', () => {
    expect(isReadOnlyBashCommand('git status && git checkout .')).toBe(false);
    expect(isReadOnlyBashCommand('git status; git push')).toBe(false);
    expect(isReadOnlyBashCommand('ls; rm -rf dist')).toBe(false);
    expect(isReadOnlyBashCommand('ls | rm -rf dist')).toBe(false);
    expect(isReadOnlyBashCommand('ls || rm -rf dist')).toBe(false);
    expect(isReadOnlyBashCommand('pnpm test & rm -rf dist')).toBe(false);
  });

  it('blocks command substitution and output redirection', () => {
    expect(isReadOnlyBashCommand('ls $(rm -rf dist)')).toBe(false);
    expect(isReadOnlyBashCommand('ls `rm -rf dist`')).toBe(false);
    expect(isReadOnlyBashCommand('cat > file')).toBe(false);
    expect(isReadOnlyBashCommand('git diff >> /tmp/patch.txt')).toBe(false);
    expect(isReadOnlyBashCommand('git status 2> /tmp/err.txt')).toBe(false);
  });

  it('blocks commands chained over a newline', () => {
    expect(isReadOnlyBashCommand('ls\nrm -rf dist')).toBe(false);
  });

  it('rejects empty or leading-separator commands', () => {
    expect(isReadOnlyBashCommand('')).toBe(false);
    expect(isReadOnlyBashCommand('; ls')).toBe(false);
  });
});

// ── DANGEROUS_PATTERNS ───────────────────────────────────────────────

describe('DANGEROUS_PATTERNS', () => {
  it('catches destructive commands', () => {
    for (const command of ['rm -rf /', 'dd if=/dev/zero of=/dev/sda', 'mkfs.ext4 /dev/sdb']) {
      expect(DANGEROUS_PATTERNS.some((pattern) => pattern.test(command))).toBe(true);
    }
  });

  it('does not match benign commands', () => {
    for (const command of ['ls -la', 'git status', 'pnpm test']) {
      expect(DANGEROUS_PATTERNS.some((pattern) => pattern.test(command))).toBe(false);
    }
  });
});

// ── createToolCallHandler ────────────────────────────────────────────

const createOptions = (
  overrides: Partial<ToolCallHandlerOptions> = {},
): ToolCallHandlerOptions => ({
  delegationTool: 'task',
  getActiveTools: () => [],
  getState: () => createInitialState(),
  isBashTool: (event) => event.toolName === 'bash',
  isReadTool: (event) => event.toolName === 'read',
  isWriteTool: (event) => event.toolName === 'edit' || event.toolName === 'write',
  ...overrides,
});

describe('createToolCallHandler', () => {
  it('returns undefined for missing tool names', async () => {
    const handler = createToolCallHandler(createOptions());

    await expect(handler({}, {})).resolves.toBeUndefined();
    await expect(handler({ toolName: '' }, {})).resolves.toBeUndefined();
  });

  it('blocks orchestrator mutations while a mode is active and the delegation tool is present', async () => {
    const state = { ...createInitialState(), mode: 'fein' as const };
    const handler = createToolCallHandler(
      createOptions({ getActiveTools: () => ['task', 'read'], getState: () => state }),
    );

    const result = await handler({ input: { path: 'src/a.ts' }, toolName: 'edit' }, {});

    expect(result?.block).toBe(true);
    expect(result?.reason).toContain("'edit' is blocked");
  });

  it('allows the delegation tool, reads, and read-only bash while a mode is active', async () => {
    const state = { ...createInitialState(), mode: 'fein' as const };
    const handler = createToolCallHandler(
      createOptions({ getActiveTools: () => ['task', 'read'], getState: () => state }),
    );

    await expect(handler({ toolName: 'task' }, {})).resolves.toBeUndefined();
    await expect(
      handler({ input: { path: 'a.ts' }, toolName: 'read' }, {}),
    ).resolves.toBeUndefined();
    await expect(
      handler({ input: { command: 'git status' }, toolName: 'bash' }, {}),
    ).resolves.toBeUndefined();
  });

  it('blocks chained bash that hides a mutation behind a read-only prefix', async () => {
    const state = { ...createInitialState(), mode: 'sonar' as const };
    const handler = createToolCallHandler(
      createOptions({ getActiveTools: () => ['task'], getState: () => state }),
    );

    const result = await handler(
      { input: { command: 'git status && git checkout .' }, toolName: 'bash' },
      {},
    );

    expect(result?.block).toBe(true);
  });

  it('blocks writes and bash in review mode but allows reads', async () => {
    const state = { ...createInitialState(), reviewMode: true };
    const handler = createToolCallHandler(createOptions({ getState: () => state }));

    await expect(handler({ toolName: 'read' }, {})).resolves.toBeUndefined();
    const writeResult = await handler({ input: { path: 'a.ts' }, toolName: 'write' }, {});
    expect(writeResult).toMatchObject({ block: true });
    expect(writeResult?.reason).toContain('Review mode is active');
    const bashResult = await handler({ input: { command: 'rm -rf dist' }, toolName: 'bash' }, {});
    expect(bashResult?.block).toBe(true);
  });

  it('blocks dangerous patterns and allows them only when the UI confirms', async () => {
    const handler = createToolCallHandler(createOptions());
    const event = { input: { command: 'rm -rf /' }, toolName: 'bash' };

    const blocked = await handler(event, {});
    expect(blocked?.block).toBe(true);
    expect(blocked?.reason).toContain('dangerous pattern');

    const confirmAllowed = vi
      .fn<(title: string, message: string) => Promise<boolean>>()
      .mockResolvedValue(true);
    await expect(
      handler(event, { hasUI: true, ui: { confirm: confirmAllowed } }),
    ).resolves.toBeUndefined();

    const confirmDenied = vi
      .fn<(title: string, message: string) => Promise<boolean>>()
      .mockResolvedValue(false);
    const denied = await handler(event, { hasUI: true, ui: { confirm: confirmDenied } });
    expect(denied?.block).toBe(true);
  });

  it('tracks read and write file access and persists through the provided callback', async () => {
    const state = createInitialState();
    const persist = vi.fn<() => void>();
    const handler = createToolCallHandler(createOptions({ getState: () => state, persist }));

    await handler({ input: { path: 'src/read.ts' }, toolName: 'read' }, {});
    await handler({ input: { path: 'src/write.ts' }, toolName: 'write' }, {});

    expect(state.filesRead).toEqual(['src/read.ts']);
    expect(state.filesModified).toEqual(['src/write.ts']);
    expect(persist).toHaveBeenCalledTimes(2);
  });

  it('falls back to the pi adapter for persistence when no callback is given', async () => {
    const state = createInitialState();
    const appendEntry = vi.fn<(type: string, data: unknown) => void>();
    const handler = createToolCallHandler(
      createOptions({ getState: () => state, pi: { appendEntry } }),
    );

    await handler({ input: { path: 'src/read.ts' }, toolName: 'read' }, {});

    expect(appendEntry).toHaveBeenCalledWith(
      'maestria_state',
      expect.objectContaining({ filesRead: ['src/read.ts'] }),
    );
  });

  it('does not persist or track when the file path is missing', async () => {
    const state = createInitialState();
    const persist = vi.fn<() => void>();
    const handler = createToolCallHandler(createOptions({ getState: () => state, persist }));

    await handler({ input: {}, toolName: 'read' }, {});

    expect(state.filesRead).toEqual([]);
    expect(persist).not.toHaveBeenCalled();
  });

  it('honors delegation hints and extra mutation tools', async () => {
    const state = { ...createInitialState(), mode: 'blitz' as const };
    const handler = createToolCallHandler(
      createOptions({
        delegationHint: 'Delegate with task().',
        delegationTool: 'subagent',
        extraMutations: ['goal'],
        getActiveTools: () => ['subagent'],
        getState: () => state,
      }),
    );

    const goalResult = await handler({ toolName: 'goal' }, {});
    expect(goalResult?.block).toBe(true);
    expect(goalResult?.reason).toContain('Delegate with task().');

    const subagentResult = await handler({ toolName: 'subagent' }, {});
    expect(subagentResult).toBeUndefined();
  });
});
