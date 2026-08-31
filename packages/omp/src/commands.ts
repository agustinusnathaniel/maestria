import { installCommands as installCommandsCore } from '@maestria/shared-pi/commands-core';
import type { ExtensionAPI } from '@oh-my-pi/pi-coding-agent';

import { isOmpModel } from '@/model.js';
import type { OmpModel } from '@/model.js';
import type { MaestriaState } from '@/state.js';

export interface CommandsContext {
  model?: { id: string };
  modelRegistry: { getAll: () => { id: string }[] };
  ui: {
    notify: (message: string) => void;
    setEditorText: (text: string) => void;
  };
}

export interface CommandsApi {
  appendEntry: (customType: string, data?: unknown) => void;
  events?: { emit: (event: string, data: unknown) => void };
  getActiveTools: () => string[];
  registerCommand: (
    name: string,
    options: {
      description?: string;
      handler: (args: string, ctx: CommandsContext) => Promise<void> | void;
    },
  ) => void;
  sendUserMessage: (text: string, options: { deliverAs: 'steer' | 'followUp' }) => void;
  setActiveTools: (tools: string[]) => void | Promise<void>;
  setModel: (model: OmpModel) => Promise<boolean>;
}

export const createCommandsApi = (pi: ExtensionAPI): CommandsApi => ({
  appendEntry: (type, data) => {
    pi.appendEntry(type, data);
  },
  events: {
    emit: (event, data) => {
      pi.events.emit(event, data);
    },
  },
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
    pi.sendUserMessage(text, { deliverAs: options.deliverAs });
  },
  setActiveTools: async (tools) => {
    await pi.setActiveTools(tools);
  },
  setModel: async (model) => await pi.setModel(model),
});

interface CommandsEvents {
  emit: (event: string, data: unknown) => void;
}

const getCommandsEvents = (pi: CommandsApi): CommandsEvents | undefined => {
  if (!('events' in pi) || typeof pi.events !== 'object' || pi.events === null) {
    return undefined;
  }
  if (!('emit' in pi.events) || typeof pi.events.emit !== 'function') {
    return undefined;
  }
  const { events } = pi;
  return {
    emit: (event, data) => {
      events.emit(event, data);
    },
  };
};

export const installCommands = (pi: CommandsApi, state: MaestriaState): void => {
  installCommandsCore(
    {
      appendEntry: (customType, data) => {
        pi.appendEntry(customType, data);
      },
      events: getCommandsEvents(pi),
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
    },
    state,
  );
};
