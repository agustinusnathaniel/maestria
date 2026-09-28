import type { ExtensionAPI } from '@oh-my-pi/pi-coding-agent';
import { createInitialState } from '@maestria/shared-pi/state-core';
import { describe, expect, it, vi } from 'vite-plus/test';

import { installModeCommands } from '@/modes.js';

// ---------------------------------------------------------------------------
// installModeCommands
// ---------------------------------------------------------------------------

interface TestCommandContext {
  ui: { notify: (message: string) => void };
}

interface ModeCommand {
  description?: string;
  handler: (args: string, ctx: TestCommandContext) => Promise<void> | void;
}

interface MockPi {
  _commands: Record<string, ModeCommand>;
  appendEntry: ReturnType<typeof vi.fn<(type: string, data?: unknown) => void>>;
  registerCommand: (name: string, config: ModeCommand) => void;
  setActiveTools: ReturnType<typeof vi.fn<ExtensionAPI['setActiveTools']>>;
  setModel: ReturnType<typeof vi.fn<ExtensionAPI['setModel']>>;
}

describe('installModeCommands', () => {
  const createMockPi = (): MockPi => {
    const commands: Record<string, ModeCommand> = {};
    return {
      _commands: commands,
      appendEntry: vi.fn<(type: string, data?: unknown) => void>(),
      registerCommand: (name, config) => {
        commands[name] = config;
      },
      setActiveTools: vi.fn<ExtensionAPI['setActiveTools']>(),
      setModel: vi.fn<ExtensionAPI['setModel']>(),
    };
  };

  it('registers the mode command names with the runtime', () => {
    const pi = createMockPi();

    installModeCommands(pi, createInitialState());

    expect(Object.keys(pi._commands)).toEqual(['mode-clear', 'fein', 'sonar', 'blitz']);
  });

  it('registers each mode command with its runtime description', () => {
    const pi = createMockPi();

    installModeCommands(pi, createInitialState());

    expect(pi._commands.fein.description).toBe('Set workflow mode to fein');
    expect(pi._commands.sonar.description).toBe('Set workflow mode to sonar');
    expect(pi._commands.blitz.description).toBe('Set workflow mode to blitz');
  });

  it('clears the active mode and announces neutral routing', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    state.mode = 'sonar';
    installModeCommands(pi, state);
    const ctx = { ui: { notify: vi.fn() } };

    await pi._commands['mode-clear'].handler('', ctx);

    expect(state.mode).toBeNull();
    expect(ctx.ui.notify).toHaveBeenCalledWith('Workflow mode cleared. Neutral routing is active.');
  });

  it('sets and announces the mode from a keyword command handler', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    installModeCommands(pi, state);
    const ctx = { ui: { notify: vi.fn() } };

    await pi._commands.fein.handler('build the feature', ctx);

    expect(state.mode).toBe('fein');
    expect(ctx.ui.notify).toHaveBeenCalledWith(
      "Mode set to fein. Describe what you'd like to work on.",
    );
  });

  it('persists the cleared mode through the adapter', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    state.mode = 'sonar';
    installModeCommands(pi, state);
    const ctx = { ui: { notify: vi.fn() } };

    await pi._commands['mode-clear'].handler('', ctx);

    expect(pi.appendEntry).toHaveBeenCalledWith(
      'maestria_state',
      expect.objectContaining({ mode: null }),
    );
  });

  it('persists a keyword mode through the adapter', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    installModeCommands(pi, state);
    const ctx = { ui: { notify: vi.fn() } };

    await pi._commands.blitz.handler('implement quickly', ctx);

    expect(pi.appendEntry).toHaveBeenCalledWith(
      'maestria_state',
      expect.objectContaining({ mode: 'blitz' }),
    );
  });
});
