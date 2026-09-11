import { Effect } from 'effect';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { handleConfigure } from '@/commands/configure.js';
import { CliError } from '@/lib/command-result.js';
import type { ModelConfigHandler } from '@/lib/model-config.js';

const modelConfigMocks = vi.hoisted(() => ({
  agents: ['architect', 'builder'],
  getHandler: vi.fn(),
}));
const groupMocks = vi.hoisted(() => ({
  groupMultiselect: vi.fn(),
}));
const promptMocks = vi.hoisted(() => ({
  cancel: vi.fn(),
  isCancel: vi.fn(() => false),
  select: vi.fn(),
  spinner: vi.fn(() => ({ message: vi.fn(), start: vi.fn(), stop: vi.fn() })),
}));

vi.mock('@/lib/model-config.js', () => ({
  MAESTRIA_AGENTS: modelConfigMocks.agents,
  getModelConfigHandler: modelConfigMocks.getHandler,
  isAgentName: (name: string) => modelConfigMocks.agents.includes(name),
  modelConfigHandlers: [],
}));

vi.mock('@/lib/group-multiselect.js', () => ({
  groupMultiselect: groupMocks.groupMultiselect,
}));

vi.mock('@clack/prompts', () => ({
  cancel: promptMocks.cancel,
  isCancel: promptMocks.isCancel,
  select: promptMocks.select,
  spinner: promptMocks.spinner,
}));

const noopEffect = Effect.sync(() => {});

const makeHandler = (): ModelConfigHandler => ({
  agents: modelConfigMocks.agents,
  cli: 'opencode',
  configLevels: ['global', 'project'],
  id: 'opencode',
  isAvailable: Effect.succeed(true),
  label: 'OpenCode',
  listModels: Effect.succeed(['model-a', 'model-b']),
  readCurrent: () => Effect.succeed({}),
  restartHint: 'Restart OpenCode to apply.',
  write: () => noopEffect,
});

const captureCliError = async (promise: Promise<unknown>): Promise<CliError> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof CliError) {
      return error;
    }
    throw error;
  }
  throw new Error('Expected handler to throw CliError');
};

const stdoutTty = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');
const stdinTty = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');

const setTty = (value: boolean): void => {
  Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value });
  Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value });
};

const restoreTty = (): void => {
  if (stdoutTty) {
    Object.defineProperty(process.stdout, 'isTTY', stdoutTty);
  } else {
    Reflect.deleteProperty(process.stdout, 'isTTY');
  }
  if (stdinTty) {
    Object.defineProperty(process.stdin, 'isTTY', stdinTty);
  } else {
    Reflect.deleteProperty(process.stdin, 'isTTY');
  }
};

describe('configure handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    modelConfigMocks.getHandler.mockReturnValue(makeHandler());
    promptMocks.isCancel.mockReturnValue(false);
  });

  afterEach(() => {
    restoreTty();
    vi.restoreAllMocks();
  });

  it('sets models non-interactively with --set', async () => {
    const result = await handleConfigure({
      global: true,
      json: true,
      platform: 'opencode',
      quiet: true,
      set: 'builder=model-b',
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.output)).toEqual({
      label: 'OpenCode',
      level: 'global',
      models: { architect: '', builder: 'model-b' },
      platform: 'opencode',
    });
  });

  it('reports no changes when the interactive selection resolves to inherit', async () => {
    setTty(true);
    groupMocks.groupMultiselect.mockResolvedValue(['builder']);
    promptMocks.select.mockResolvedValue('');

    const result = await handleConfigure({ global: true, platform: 'opencode', quiet: true });

    expect(result).toEqual({ exitCode: 0, output: 'No changes. Nothing to write.' });
  });

  it('throws CliError outside a TTY when no --set is provided', async () => {
    setTty(false);

    const error = await captureCliError(handleConfigure({ global: true, platform: 'opencode' }));

    expect(error.exitCode).toBe(1);
    expect(error.message).toContain('No --set provided and not in an interactive terminal.');
  });

  it('returns exit code 130 when the interactive prompt is cancelled', async () => {
    setTty(true);
    promptMocks.select.mockResolvedValue(Symbol('cancel'));
    promptMocks.isCancel.mockReturnValue(true);

    const error = await captureCliError(handleConfigure({ platform: 'opencode' }));

    expect(promptMocks.cancel).toHaveBeenCalledWith('Cancelled.');
    expect(error.exitCode).toBe(130);
    expect(error.message).toBe('');
  });

  it('throws CliError for an unknown --set agent', async () => {
    const error = await captureCliError(
      handleConfigure({
        global: true,
        platform: 'opencode',
        quiet: true,
        set: 'nobody=model-a',
      }),
    );

    expect(error.exitCode).toBe(1);
    expect(error.message).toContain("Unknown agent 'nobody'");
  });
});
