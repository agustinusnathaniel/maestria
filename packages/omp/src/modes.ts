import {
  installModeAutoDetect as installAutoDetect,
  installModeCommands as installCommands,
} from '@maestria/shared-pi/modes-core';
import type { ExtensionAPI, ExtensionContext } from '@oh-my-pi/pi-coding-agent';

import type { OmpModel } from '@/model.js';
import type { MaestriaState } from '@/state.js';
import { persistState, restoreOriginalState } from '@/state.js';

const __dirname = import.meta.dirname;
const COMMANDS_DIR = `${__dirname}/../agents/commands`;

const isExtensionContext = (value: unknown): value is ExtensionContext => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  return 'modelRegistry' in value && 'ui' in value;
};

export interface ModeCommandContext {
  ui: { notify: (message: string) => void };
}

export interface ModeCommandsApi {
  appendEntry: (type: string, data?: unknown) => void;
  registerCommand: (
    name: string,
    options: {
      description: string;
      handler: (args: string, ctx: ModeCommandContext) => Promise<void> | void;
    },
  ) => void;
  sendUserMessage: (text: string, options: { deliverAs: 'steer' | 'followUp' }) => void;
  setActiveTools: (tools: string[]) => Promise<void>;
  setModel: (model: OmpModel) => Promise<boolean>;
}

export const createModeCommandsApi = (pi: ExtensionAPI): ModeCommandsApi => ({
  appendEntry: (type, data) => {
    pi.appendEntry(type, data);
  },
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

export const installModeAutoDetect = (pi: ExtensionAPI, state: MaestriaState): void => {
  installAutoDetect(
    (handler) => {
      pi.on('input', handler);
    },
    state,
    COMMANDS_DIR,
    {
      noMatch: {},
      persistState: () => {
        persistState(pi, state);
      },
      restoreOriginalState: async (ctx) => {
        if (isExtensionContext(ctx)) {
          await restoreOriginalState(pi, ctx, state);
        }
      },
      transform: (text) => ({ text }),
    },
  );
};

export const installModeCommands = (pi: ModeCommandsApi, state: MaestriaState): void => {
  installCommands<ModeCommandContext>(
    (name, opts) => {
      pi.registerCommand(name, {
        description: opts.description,
        handler: async (args, ctx) => {
          await opts.handler(args, ctx);
        },
      });
    },
    state,
    {
      persistState: () => {
        persistState(pi, state);
      },
      restoreOriginalState: async (ctx) => {
        if (isExtensionContext(ctx)) {
          await restoreOriginalState(pi, ctx, state);
        }
      },
    },
  );
};
