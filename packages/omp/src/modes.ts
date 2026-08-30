import type { ExtensionAPI, ExtensionContext } from '@oh-my-pi/pi-coding-agent';
import type { MaestriaState } from '@/state.js';
import { persistState, restoreOriginalState } from '@/state.js';
import {
  installModeAutoDetect as installAutoDetect,
  installModeCommands as installCommands,
} from '@maestria/shared-pi/modes-core';

const __dirname = import.meta.dirname;
const COMMANDS_DIR = `${__dirname}/../agents/commands`;

export function installModeAutoDetect(pi: ExtensionAPI, state: MaestriaState): void {
  installAutoDetect(
    (handler) => {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: narrow from unknown/union via runtime check, safe type assertion
      pi.on('input', handler as never);
    },
    state,
    COMMANDS_DIR,
    {
      noMatch: {},
      persistState: () => {
        persistState(pi, state);
      },
      restoreOriginalState: async (ctx) => {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: narrow from unknown/union via runtime check, safe type assertion
        await restoreOriginalState(pi, ctx as ExtensionContext, state);
      },
      transform: (text) => ({ text }),
    },
  );
}

export function installModeCommands(pi: ExtensionAPI, state: MaestriaState): void {
  installCommands(
    (name, opts) => {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: narrow from unknown/union via runtime check, safe type assertion
      pi.registerCommand(name, opts as never);
    },
    state,
    {
      persistState: () => {
        persistState(pi, state);
      },
      restoreOriginalState: async (ctx) => {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: narrow from unknown/union via runtime check, safe type assertion
        await restoreOriginalState(pi, ctx as ExtensionContext, state);
      },
    },
  );
}
