import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ExtensionAPI, ExtensionContext } from '@oh-my-pi/pi-coding-agent';
import type { MaestriaState } from '@/state.js';
import { persistState, restoreOriginalState } from '@/state.js';
import {
  installModeAutoDetect as installAutoDetect,
  installModeCommands as installCommands,
} from '@maestria/shared-pi/modes-core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMMANDS_DIR = __dirname + '/../agents/commands';

export function installModeAutoDetect(pi: ExtensionAPI, state: MaestriaState): void {
  installAutoDetect((handler) => pi.on('input', handler as never), state, COMMANDS_DIR, {
    restoreOriginalState: (ctx) => restoreOriginalState(pi, ctx as ExtensionContext, state),
    persistState: () => persistState(pi, state),
    noMatch: {},
    transform: (text) => ({ text }),
  });
}

export function installModeCommands(pi: ExtensionAPI, state: MaestriaState): void {
  installCommands((name, opts) => pi.registerCommand(name, opts as never), state, {
    restoreOriginalState: (ctx) => restoreOriginalState(pi, ctx as ExtensionContext, state),
    persistState: () => persistState(pi, state),
  });
}
