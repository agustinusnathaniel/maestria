import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, vi } from 'vite-plus/test';
import { MODE_KEYWORDS, getModePrompt } from '@maestria/shared-pi/modes-core';
import { installModeCommands } from '@/modes.js';
import { createInitialState } from '@/state.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMMANDS_DIR = __dirname + '/../agents/commands';

// ---------------------------------------------------------------------------
// MODE_KEYWORDS
// ---------------------------------------------------------------------------
describe('MODE_KEYWORDS', () => {
  it('should contain fein, sonar, blitz', () => {
    expect(MODE_KEYWORDS).toEqual(['fein', 'sonar', 'blitz']);
  });

  it('is a readonly tuple', () => {
    // Type-level check - the const assertion ensures this is a tuple
    expect(MODE_KEYWORDS.length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// getModePrompt
// ---------------------------------------------------------------------------
describe('getModePrompt', () => {
  it('returns a string containing the marker for each keyword', () => {
    for (const kw of MODE_KEYWORDS) {
      const prompt = getModePrompt(kw, COMMANDS_DIR);
      expect(prompt).toContain(`[MODE: ${kw}]`);
    }
  });

  it('returns the marker at the start of the prompt', () => {
    for (const kw of MODE_KEYWORDS) {
      const prompt = getModePrompt(kw, COMMANDS_DIR);
      expect(prompt.startsWith(`[MODE: ${kw}]`)).toBe(true);
    }
  });

  it('getModePrompt("fein") contains "Full Pipeline"', () => {
    const prompt = getModePrompt('fein', COMMANDS_DIR);
    expect(prompt).toContain('Full Pipeline');
  });

  it('getModePrompt("sonar") contains "Research Only"', () => {
    const prompt = getModePrompt('sonar', COMMANDS_DIR);
    expect(prompt).toContain('Research Only');
  });

  it('getModePrompt("blitz") contains "Fast Implementation"', () => {
    const prompt = getModePrompt('blitz', COMMANDS_DIR);
    expect(prompt).toContain('Fast Implementation');
  });
});

// ---------------------------------------------------------------------------
// installModeCommands
// ---------------------------------------------------------------------------
describe('installModeCommands', () => {
  function createMockPi() {
    const commands: Record<string, { description: string; handler: (...args: any[]) => any }> = {};
    return {
      registerCommand: (
        name: string,
        config: { description: string; handler: (...args: any[]) => any },
      ) => {
        commands[name] = config;
      },
      sendUserMessage: (_content: string | unknown[], _options?: { deliverAs?: string }) => {},
      appendEntry: vi.fn(),
      _commands: commands,
    } as any;
  }

  it('calls pi.registerCommand for each keyword', () => {
    const pi = createMockPi();
    const state = createInitialState();

    installModeCommands(pi as any, state);

    expect(Object.keys(pi._commands)).toEqual(['mode-clear', 'fein', 'sonar', 'blitz']);
  });

  it('clears the active mode and persists neutral state', async () => {
    const pi = createMockPi();
    const state = createInitialState();
    state.mode = 'sonar';
    installModeCommands(pi as any, state);
    const ctx = { ui: { notify: vi.fn() } };
    await pi._commands['mode-clear'].handler('', ctx);
    expect(state.mode).toBeNull();
    expect(ctx.ui.notify).toHaveBeenCalledWith('Workflow mode cleared. Neutral routing is active.');
  });

  it('registers all 3 commands with correct descriptions', () => {
    const pi = createMockPi();
    const state = createInitialState();

    installModeCommands(pi as any, state);

    expect(pi._commands.fein.description).toBe('Set workflow mode to fein');
    expect(pi._commands.sonar.description).toBe('Set workflow mode to sonar');
    expect(pi._commands.blitz.description).toBe('Set workflow mode to blitz');
  });

  describe('handler for fein command', () => {
    it('with args, sets state.mode to "fein" and calls ctx.ui.notify', async () => {
      const pi = createMockPi();
      const state = createInitialState();
      installModeCommands(pi as any, state);

      const handler = pi._commands.fein.handler;
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
      installModeCommands(pi as any, state);

      const handler = pi._commands.fein.handler;
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
      installModeCommands(pi as any, state);

      const handler = pi._commands.fein.handler;
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
      const pi = {
        registerCommand: (name: string, config: any) => {
          pi._commands[name] = config;
        },
        sendUserMessage: vi.fn(),
        appendEntry: vi.fn(),
        _commands: {} as Record<string, any>,
      };
      const state = createInitialState();
      installModeCommands(pi as any, state);

      const handler = pi._commands.fein.handler;
      const ctx = { ui: { notify: vi.fn() } };
      await handler('build feature', ctx);

      expect(state.mode).toBe('fein');
      expect(pi.appendEntry).toHaveBeenCalledWith(
        'maestria_state',
        expect.objectContaining({ mode: 'fein' }),
      );
    });

    it('persists state via appendEntry after setting sonar mode', async () => {
      const pi = {
        registerCommand: (name: string, config: any) => {
          pi._commands[name] = config;
        },
        sendUserMessage: vi.fn(),
        appendEntry: vi.fn(),
        _commands: {} as Record<string, any>,
      };
      const state = createInitialState();
      installModeCommands(pi as any, state);

      const handler = pi._commands.sonar.handler;
      const ctx = { ui: { notify: vi.fn() } };
      await handler('research', ctx);

      expect(state.mode).toBe('sonar');
      expect(pi.appendEntry).toHaveBeenCalledWith(
        'maestria_state',
        expect.objectContaining({ mode: 'sonar' }),
      );
    });

    it('persists state via appendEntry after setting blitz mode', async () => {
      const pi = {
        registerCommand: (name: string, config: any) => {
          pi._commands[name] = config;
        },
        sendUserMessage: vi.fn(),
        appendEntry: vi.fn(),
        _commands: {} as Record<string, any>,
      };
      const state = createInitialState();
      installModeCommands(pi as any, state);

      const handler = pi._commands.blitz.handler;
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
