import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { CommandsPi } from '@maestria/shared-pi/commands-core';

import { isPiModel } from '@/model.js';

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
