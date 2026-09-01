import { describe, expect, it, vi } from 'vite-plus/test';

import { installModeCommands } from '@/modes.js';
import type { ModeCommandsApi } from '@/modes.js';
import { createInitialState } from '@/state.js';

// ---------------------------------------------------------------------------
// installModeCommands
// ---------------------------------------------------------------------------
describe('installModeCommands', () => {
  type ModeCommand = Parameters<ModeCommandsApi['registerCommand']>[1];

  interface MockPi extends ModeCommandsApi {
    _commands: Record<string, ModeCommand>;
    appendEntry: ReturnType<typeof vi.fn<ModeCommandsApi['appendEntry']>>;
    registerCommand: ReturnType<typeof vi.fn<ModeCommandsApi['registerCommand']>>;
    sendUserMessage: ReturnType<typeof vi.fn<ModeCommandsApi['sendUserMessage']>>;
    setActiveTools: ReturnType<typeof vi.fn<ModeCommandsApi['setActiveTools']>>;
    setModel: ReturnType<typeof vi.fn<ModeCommandsApi['setModel']>>;
  }

  const createMockPi = (): MockPi => {
    const commands: Record<string, ModeCommand> = {};
    return {
      _commands: commands,
      appendEntry: vi.fn(),
      registerCommand: vi.fn<ModeCommandsApi['registerCommand']>((name, config) => {
        commands[name] = config;
      }),
      sendUserMessage: vi.fn(),
      setActiveTools: vi.fn(async (): Promise<void> => {}),
      setModel: vi.fn().mockResolvedValue(true),
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
    const ctx = { ui: { notify: vi.fn() } };
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
    it('with args, sets state.mode to "fein" and calls ctx.ui.notify', async () => {
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

      await handler('build the feature', ctx);

      expect(state.mode).toBe('fein');
      expect(notifyMessage).toBe("Mode set to fein. Describe what you'd like to work on.");
    });

    it('without args, sets state.mode but calls ctx.ui.notify', async () => {
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

    it('with whitespace-only args, sets state.mode and calls ctx.ui.notify', async () => {
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
