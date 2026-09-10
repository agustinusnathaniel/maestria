import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { installCommands as installCommandsCore } from '@maestria/shared-pi/commands-core';
import type { CommandsPi } from '@maestria/shared-pi/commands-core';

import { isPiModel } from '@/model.js';
import type { MaestriaState } from '@/state.js';

export const createCommandsApi = (pi: ExtensionAPI): CommandsPi => ({
  appendEntry: (type, data) => {
    pi.appendEntry(type, data);
  },
  events: pi.events,
  getActiveTools: () => pi.getActiveTools(),
  registerCommand: (name, options) => {
    pi.registerCommand(name, {
      description: options.description,
      handler: async (args, ctx) => {
        await options.handler(args, ctx);
      },
    });
  },
  sendUserMessage: (text, options) => {
    if (options.deliverAs === 'steer' || options.deliverAs === 'followUp') {
      pi.sendUserMessage(text, { deliverAs: options.deliverAs });
    }
  },
  setActiveTools: (tools) => {
    pi.setActiveTools(tools);
  },
  setModel: async (model) => {
    if (isPiModel(model)) {
      await pi.setModel(model);
    }
  },
});

export const installCommands = (pi: CommandsPi, state: MaestriaState): void => {
  installCommandsCore(pi, state);
};
