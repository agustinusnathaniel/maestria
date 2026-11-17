import type { ExtensionAPI, InputEventResult } from '@earendil-works/pi-coding-agent';
import {
  detectMode,
  extractModeSection,
  MODE_KEYWORDS,
  MODE_MARKERS,
  stripKeyword,
} from '@maestria/shared-mode';
import type { ModeKeyword } from '@maestria/shared-mode';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { restoreOriginalState } from '@/review.js';
import type { ReviewHost, ReviewModelContext } from '@/review.js';
import { persistState } from '@/state.js';
import type { MaestriaState } from '@/state.js';

const COMMANDS_DIR = path.resolve(import.meta.dirname, '../agents/commands');

const promptCache = new Map<string, string>();

const loadModeBody = (keyword: ModeKeyword, commandsDir: string): string => {
  const file = path.resolve(commandsDir, `${keyword}.md`);
  let body = promptCache.get(file);
  if (body === undefined) {
    try {
      body = extractModeSection(readFileSync(file, 'utf-8'));
    } catch (error) {
      console.warn(`[maestria] Failed to load mode prompt "${keyword}":`, error);
      body = '';
    }
    promptCache.set(file, body);
  }
  return body;
};

/** The mode marker followed by the mode section of the generated command file. */
export const getModePrompt = (keyword: ModeKeyword, commandsDir = COMMANDS_DIR): string =>
  `${MODE_MARKERS[keyword]}\n\n${loadModeBody(keyword, commandsDir)}`;

type ModeHost = ReviewHost & Pick<ExtensionAPI, 'appendEntry'>;

/** Leaves review mode first; false when the original model or tools could not be restored. */
const leaveReviewMode = async (
  pi: ModeHost,
  ctx: ReviewModelContext,
  state: MaestriaState,
): Promise<boolean> => !state.reviewMode || (await restoreOriginalState(pi, ctx, state));

export const installModeAutoDetect = (
  pi: ModeHost & Pick<ExtensionAPI, 'on'>,
  state: MaestriaState,
  commandsDir = COMMANDS_DIR,
): void => {
  pi.on('input', async (event, ctx): Promise<InputEventResult> => {
    const detected = detectMode(event.text);
    if (detected === null || !(await leaveReviewMode(pi, ctx, state))) {
      return { action: 'continue' };
    }
    state.mode = detected.mode;
    persistState(pi, state);
    const prompt = getModePrompt(detected.mode, commandsDir);
    const stripped = stripKeyword(event.text, detected);
    return { action: 'transform', text: stripped ? `${prompt}\n\n${stripped}` : prompt };
  });
};

type ModeCommandsHost = ModeHost & {
  registerCommand: (
    name: string,
    options: {
      description: string;
      handler: (args: string, ctx: ReviewModelContext) => Promise<void>;
    },
  ) => void;
};

export const installModeCommands = (pi: ModeCommandsHost, state: MaestriaState): void => {
  pi.registerCommand('mode-clear', {
    description: 'Clear workflow mode and return to neutral routing',
    handler: async (_args, ctx) => {
      if (!(await leaveReviewMode(pi, ctx, state))) {
        return;
      }
      state.mode = null;
      persistState(pi, state);
      ctx.ui.notify('Workflow mode cleared. Neutral routing is active.');
    },
  });

  for (const keyword of MODE_KEYWORDS) {
    pi.registerCommand(keyword, {
      description: `Set workflow mode to ${keyword}`,
      handler: async (_args, ctx) => {
        if (!(await leaveReviewMode(pi, ctx, state))) {
          return;
        }
        state.mode = keyword;
        persistState(pi, state);
        ctx.ui.notify(`Mode set to ${keyword}. Describe what you'd like to work on.`);
      },
    });
  }
};
