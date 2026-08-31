import { installCommands as installCommandsCore } from '@maestria/shared-pi/commands-core';
import type { ExtensionAPI } from '@oh-my-pi/pi-coding-agent';

import type { MaestriaState } from '@/state.js';

export function installCommands(pi: ExtensionAPI, state: MaestriaState): void {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: narrow from unknown/union via runtime check, safe type assertion
  installCommandsCore(pi as never, state);
}
