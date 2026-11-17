import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { MODE_KEYWORDS } from '@maestria/shared-mode';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { getModePrompt, installModeAutoDetect, installModeCommands } from '@/modes.js';
import { createInitialState } from '@/state.js';
import type { MaestriaState } from '@/state.js';

let commandsDir: string;

beforeEach(() => {
  commandsDir = mkdtempSync(path.join(tmpdir(), 'maestria-modes-'));
  for (const keyword of MODE_KEYWORDS) {
    writeFileSync(
      path.join(commandsDir, `${keyword}.md`),
      `# Title\n\nIntro.\n\n## MODE: ${keyword}\n\nFull pipeline for ${keyword}.\n`,
    );
  }
});

afterEach(() => {
  rmSync(commandsDir, { force: true, recursive: true });
});

describe('getModePrompt', () => {
  it('prefixes the mode section of the command file with its marker', () => {
    expect(getModePrompt('sonar', commandsDir)).toBe(
      '[MODE: sonar]\n\n## MODE: sonar\n\nFull pipeline for sonar.\n',
    );
  });

  it('returns the marker with an empty body when the command file is missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    rmSync(path.join(commandsDir, 'blitz.md'));
    try {
      expect(getModePrompt('blitz', commandsDir)).toBe('[MODE: blitz]\n\n');
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load mode prompt "blitz"'),
        expect.any(Error),
      );
    } finally {
      warn.mockRestore();
    }
  });

  it('loads prompt content independently for each commands directory', () => {
    expect(getModePrompt('fein', commandsDir)).toContain('Full pipeline for fein.');
    const alternateDir = mkdtempSync(path.join(tmpdir(), 'maestria-modes-alt-'));
    try {
      writeFileSync(path.join(alternateDir, 'fein.md'), '## MODE: fein\n\nAlternate pipeline.');
      expect(getModePrompt('fein', alternateDir)).toContain('Alternate pipeline.');
    } finally {
      rmSync(alternateDir, { force: true, recursive: true });
    }
  });
});

describe('installModeAutoDetect', () => {
  type InputHandler = (event: { text: string }, ctx: unknown) => Promise<unknown>;

  const setup = (): {
    appendEntry: ReturnType<typeof vi.fn>;
    input: InputHandler;
    state: MaestriaState;
  } => {
    const handlers: InputHandler[] = [];
    const pi = {
      appendEntry: vi.fn(),
      on: (_event: string, handler: InputHandler) => {
        handlers.push(handler);
      },
      setActiveTools: vi.fn(),
      setModel: vi.fn(),
    };
    const state = createInitialState();
    Reflect.apply(installModeAutoDetect, undefined, [pi, state, commandsDir]);
    const [input] = handlers;
    if (input === undefined) {
      throw new Error('input handler was not registered');
    }
    return { appendEntry: pi.appendEntry, input, state };
  };

  it('sets the mode and sends its prompt before the message without the keyword', async () => {
    const { appendEntry, input, state } = setup();
    const prompt = getModePrompt('fein', commandsDir);

    await expect(input({ text: 'fein implement login' }, {})).resolves.toEqual({
      action: 'transform',
      text: `${prompt}\n\nimplement login`,
    });
    expect(state.mode).toBe('fein');
    expect(appendEntry).toHaveBeenCalledWith(
      'maestria_state',
      expect.objectContaining({ mode: 'fein' }),
    );
    await expect(input({ text: 'sonar' }, {})).resolves.toEqual({
      action: 'transform',
      text: getModePrompt('sonar', commandsDir),
    });
  });

  it('continues unchanged when the message has no mode keyword', async () => {
    const { input, state } = setup();

    await expect(input({ text: 'implement login' }, {})).resolves.toEqual({ action: 'continue' });
    await expect(input({ text: '' }, {})).resolves.toEqual({ action: 'continue' });
    expect(state.mode).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// installModeCommands
// ---------------------------------------------------------------------------

interface TestCommandContext {
  modelRegistry: { getAll: () => { id: string }[] };
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

describe('installModeCommands', () => {
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
    const ctx: TestCommandContext = {
      modelRegistry: { getAll: () => [] },
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
    it('without args, sets state.mode but calls ctx.ui.notify instead', async () => {
      const pi = createMockPi();
      const state = createInitialState();
      installModeCommands(pi, state);

      const { handler } = pi._commands.fein;
      let notifyMessage: string | undefined;
      const ctx = {
        modelRegistry: { getAll: () => [] },
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
        modelRegistry: { getAll: () => [] },
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
    it('persists state via appendEntry after setting fein, sonar, or blitz mode', async () => {
      for (const mode of ['fein', 'sonar', 'blitz']) {
        const pi = createMockPi();
        const state = createInitialState();
        installModeCommands(pi, state);

        const { handler } = pi._commands[mode];
        const ctx = { modelRegistry: { getAll: () => [] }, ui: { notify: vi.fn() } };
        // oxlint-disable-next-line no-await-in-loop -- sequential awaits keep each mode's failure attributable.
        await handler('build feature', ctx);

        expect(state.mode).toBe(mode);
        expect(pi.appendEntry).toHaveBeenCalledWith(
          'maestria_state',
          expect.objectContaining({ mode }),
        );
      }
    });
  });
});
