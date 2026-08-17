import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { MaestriaState } from '@/state.js';
import { installCommands as installCommandsCore } from '@maestria/shared-pi/commands-core';

export function installCommands(pi: ExtensionAPI, state: MaestriaState): void {
  installCommandsCore(pi as never, state);
}
