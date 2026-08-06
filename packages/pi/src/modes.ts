import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';
import type { MaestriaState } from '@/state.js';
import { persistState, restoreOriginalState } from '@/state.js';
import {
  createModeController,
  installModeAutoDetect as installAutoDetect,
  installModeCommands as installCommands,
  type ModeController,
} from '@maestria/shared-pi/modes-core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMMANDS_DIR = resolve(__dirname, '../agents/commands');

export function installModeAutoDetect(
  pi: ExtensionAPI,
  state: MaestriaState,
  modeController: ModeController = createModeController(state),
): void {
  installAutoDetect((handler) => pi.on('input', handler as never), state, COMMANDS_DIR, {
    restoreOriginalState: (ctx) => restoreOriginalState(pi, ctx as ExtensionContext, state),
    noMatch: { action: 'continue' as const },
    transform: (text) => ({ action: 'transform' as const, text }),
    setAutomaticMode: (mode) => modeController.setAutomaticMode(mode),
  });
}

export function installModeCommands(
  pi: ExtensionAPI,
  state: MaestriaState,
  modeController: ModeController = createModeController(state),
): void {
  installCommands((name, opts) => pi.registerCommand(name, opts as never), state, {
    restoreOriginalState: (ctx) => restoreOriginalState(pi, ctx as ExtensionContext, state),
    persistState: () => persistState(pi, state),
    clearAutomaticMode: () => modeController.clearAutomaticMode(),
  });
}
