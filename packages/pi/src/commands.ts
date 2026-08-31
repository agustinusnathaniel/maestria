import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { installCommands as installCommandsCore } from '@maestria/shared-pi/commands-core';
import type { CommandsPi } from '@maestria/shared-pi/commands-core';

import type { MaestriaState } from '@/state.js';

type PiModel = Parameters<ExtensionAPI['setModel']>[0];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isPiModel = (value: unknown): value is PiModel => {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.api === 'string' &&
    typeof value.baseUrl === 'string' &&
    typeof value.contextWindow === 'number' &&
    typeof value.cost === 'object' &&
    value.cost !== null &&
    typeof value.id === 'string' &&
    Array.isArray(value.input) &&
    typeof value.maxTokens === 'number' &&
    typeof value.name === 'string' &&
    typeof value.provider === 'string' &&
    typeof value.reasoning === 'boolean'
  );
};

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
