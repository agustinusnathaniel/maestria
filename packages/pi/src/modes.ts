import type {
  ExtensionAPI,
  ExtensionContext,
  InputEventResult,
} from '@earendil-works/pi-coding-agent';
import {
  installModeAutoDetect as installAutoDetect,
  installModeCommands as installCommands,
} from '@maestria/shared-pi/modes-core';
import type { ModeCommandContext } from '@maestria/shared-pi/modes-core';
import { persistState } from '@maestria/shared-pi/state-core';
import type { MaestriaState } from '@maestria/shared-pi/state-core';
import path from 'node:path';

import { restoreOriginalState } from '@/state/review.js';

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

const isExtensionContext = (value: unknown): value is ExtensionContext => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  return 'modelRegistry' in value && 'ui' in value;
};

type ModeCommandsHost = Pick<ExtensionAPI, 'appendEntry' | 'setActiveTools' | 'setModel'> & {
  registerCommand: (
    name: string,
    options: {
      description: string;
      handler: (args: string, ctx: ModeCommandContext) => Promise<void>;
    },
  ) => void;
};

export const installModeCommands = (pi: ModeCommandsHost, state: MaestriaState): void => {
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
