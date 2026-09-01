import { describe, expect, it, vi } from 'vite-plus/test';

import type { ModeCommandContext, ModeCommandsApi } from '@/modes.js';
import { installModeCommands } from '@/modes.js';
import { createInitialState } from '@/state.js';

// ---------------------------------------------------------------------------
// installModeCommands
// ---------------------------------------------------------------------------
describe('installModeCommands', () => {
  interface ModeCommand {
    description: string;
    handler: (args: string, ctx: ModeCommandContext) => Promise<void> | void;
  }
  interface MockPi extends ModeCommandsApi {
    _commands: Record<string, ModeCommand>;
    appendEntry: ReturnType<typeof vi.fn<(type: string, data?: unknown) => void>>;
    registerCommand: (name: string, config: ModeCommand) => void;
    setActiveTools: ReturnType<typeof vi.fn<ModeCommandsApi['setActiveTools']>>;
    setModel: ReturnType<typeof vi.fn<ModeCommandsApi['setModel']>>;
  }

  const createMockPi = (): MockPi => {
    const commands: Record<string, ModeCommand> = {};
    return {
      _commands: commands,
      appendEntry: vi.fn<(type: string, data?: unknown) => void>(),
      registerCommand: (name: string, config: ModeCommand) => {
        commands[name] = config;
      },
      setActiveTools: vi.fn<ModeCommandsApi['setActiveTools']>(),
      setModel: vi.fn<ModeCommandsApi['setModel']>(),
    };
  };

  it('calls pi.registerCommand for each keyword', () => {
    const pi = createMockPi();
    const state = createInitialState();

    installModeCommands(pi, state);

    expect(Object.keys(pi._commands)).toEqual(['mode-clear', 'fein', 'sonar', 'blitz']);
  });

  it('clears the active mode and persists neutral state', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    state.mode = 'sonar';
    installModeCommands(pi, state);
    const ctx: ModeCommandContext = {
      ui: { notify: vi.fn<(message: string) => void>() },
    };
    await pi._commands['mode-clear'].handler('', ctx);
    expect(state.mode).toBeNull();
    expect(ctx.ui.notify).toHaveBeenCalledWith('Workflow mode cleared. Neutral routing is active.');
  });

  it('registers all 3 commands with correct descriptions', () => {
    const pi = createMockPi();
    const state = createInitialState();

    installModeCommands(pi, state);

    expect(pi._commands.fein.description).toBe('Set workflow mode to fein');
    expect(pi._commands.sonar.description).toBe('Set workflow mode to sonar');
    expect(pi._commands.blitz.description).toBe('Set workflow mode to blitz');
  });

  describe('handler for fein command', () => {
    it('with args, sets state.mode to "fein" and notifies (prompt injection via auto-detect)', async () => {
      let notifyMessage: string | undefined;

      const pi = createMockPi();

      const state = createInitialState();
      installModeCommands(pi, state);

      const { handler } = pi._commands.fein;
      const ctx = {
        ui: {
          notify: (msg: string) => {
            notifyMessage = msg;
          },
        },
      };
      await handler('build the feature', ctx);

      expect(state.mode).toBe('fein');
      expect(notifyMessage).toBe("Mode set to fein. Describe what you'd like to work on.");
    });

    it('without args, sets state.mode but calls ctx.ui.notify instead', async () => {
      const pi = createMockPi();
      const state = createInitialState();
      installModeCommands(pi, state);

      const { handler } = pi._commands.fein;
      let notifyMessage: string | undefined;
      const ctx = {
        ui: {
          notify: (msg: string) => {
            notifyMessage = msg;
          },
        },
      };

      await handler('', ctx);

      expect(state.mode).toBe('fein');
      expect(notifyMessage).toBe("Mode set to fein. Describe what you'd like to work on.");
    });

    it('with whitespace-only args is treated as no args', async () => {
      const pi = createMockPi();
      const state = createInitialState();
      installModeCommands(pi, state);

      const { handler } = pi._commands.fein;
      let notifyMessage: string | undefined;
      const ctx = {
        ui: {
          notify: (msg: string) => {
            notifyMessage = msg;
          },
        },
      };

      await handler('   ', ctx);

      expect(state.mode).toBe('fein');
      expect(notifyMessage).toBe("Mode set to fein. Describe what you'd like to work on.");
    });
  });

  describe('persists state on mode changes', () => {
    it('persists state via appendEntry after setting fein mode', async () => {
      const pi = createMockPi();
      const state = createInitialState();
      installModeCommands(pi, state);

      const { handler } = pi._commands.fein;
      const ctx = { ui: { notify: vi.fn() } };
      await handler('build feature', ctx);

      expect(state.mode).toBe('fein');
      expect(pi.appendEntry).toHaveBeenCalledWith(
        'maestria_state',
        expect.objectContaining({ mode: 'fein' }),
      );
    });

    it('persists state via appendEntry after setting sonar mode', async () => {
      const pi = createMockPi();
      const state = createInitialState();
      installModeCommands(pi, state);

      const { handler } = pi._commands.sonar;
      const ctx = { ui: { notify: vi.fn() } };
      await handler('research', ctx);

      expect(state.mode).toBe('sonar');
      expect(pi.appendEntry).toHaveBeenCalledWith(
        'maestria_state',
        expect.objectContaining({ mode: 'sonar' }),
      );
    });

    it('persists state via appendEntry after setting blitz mode', async () => {
      const pi = createMockPi();
      const state = createInitialState();
      installModeCommands(pi, state);

      const { handler } = pi._commands.blitz;
      const ctx = { ui: { notify: vi.fn() } };
      await handler('implement quickly', ctx);

      expect(state.mode).toBe('blitz');
      expect(pi.appendEntry).toHaveBeenCalledWith(
        'maestria_state',
        expect.objectContaining({ mode: 'blitz' }),
      );
    });
  });
});
