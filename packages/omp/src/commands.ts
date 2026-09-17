import { installCommands as installCommandsCore } from '@maestria/shared-pi/commands-core';
import type { CommandsPi } from '@maestria/shared-pi/commands-core';
import type { MaestriaState } from '@maestria/shared-pi/state-core';
import type { ExtensionAPI } from '@oh-my-pi/pi-coding-agent';

import { isOmpModel } from '@/model.js';

type CommandsHost = Pick<
  ExtensionAPI,
  | 'appendEntry'
  | 'events'
  | 'getActiveTools'
  | 'registerCommand'
  | 'sendUserMessage'
  | 'setActiveTools'
  | 'setModel'
>;

export const installCommands = (pi: CommandsHost, state: MaestriaState): void => {
  const host: CommandsPi = {
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
    setActiveTools: async (tools) => {
      await pi.setActiveTools(tools);
    },
    setModel: async (model) => {
      if (isOmpModel(model)) {
        await pi.setModel(model);
      }
    },
  };

  installCommandsCore(host, state);
};
