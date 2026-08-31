import type {
  ExtensionAPI,
  ExtensionContext,
  InputEventResult,
} from '@earendil-works/pi-coding-agent';
import {
  installModeAutoDetect as installAutoDetect,
  installModeCommands as installCommands,
} from '@maestria/shared-pi/modes-core';
import path from 'node:path';

import type { MaestriaState } from '@/state.js';
import { persistState, restoreOriginalState } from '@/state.js';

const __dirname = import.meta.dirname;
const COMMANDS_DIR = path.resolve(__dirname, '../agents/commands');

export const installModeAutoDetect = (pi: ExtensionAPI, state: MaestriaState): void => {
  installAutoDetect<ExtensionContext, InputEventResult>(
    (handler) => {
      pi.on('input', handler);
    },
    state,
    COMMANDS_DIR,
    {
      noMatch: { action: 'continue' as const },
      persistState: () => {
        persistState(pi, state);
      },
      restoreOriginalState: async (ctx) => {
        await restoreOriginalState(pi, ctx, state);
      },
      transform: (text) => ({ action: 'transform' as const, text }),
    },
  );
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
  setActiveTools: ExtensionAPI['setActiveTools'];
  setModel: ExtensionAPI['setModel'];
}

const isExtensionContext = (value: unknown): value is ExtensionContext => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  return 'modelRegistry' in value && 'ui' in value;
};

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
  setActiveTools: (tools) => {
    pi.setActiveTools(tools);
  },
  setModel: async (model) => await pi.setModel(model),
});

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
