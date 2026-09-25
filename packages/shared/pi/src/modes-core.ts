/** Shared mode utilities for Pi-family packages (pure mechanics in shared-mode). */

import {
  extractModeSection,
  MODE_KEYWORDS as SHARED_KEYWORDS,
  MODE_MARKERS as SHARED_MARKERS,
  detectMode as sharedDetectMode,
  stripKeyword as sharedStripKeyword,
} from '@maestria/shared-mode';
import type { ModeKeyword as SharedModeKeyword } from '@maestria/shared-mode';
import { memoize } from 'es-toolkit';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { MaestriaState } from './state-core.js';

const MODE_KEYWORDS = SHARED_KEYWORDS;
const MODE_CLEAR_COMMAND = 'mode-clear';
export type ModeKeyword = SharedModeKeyword;

export const MODE_MARKERS: Record<ModeKeyword, string> = SHARED_MARKERS;

/** Load a mode prompt from a commands directory. */
export const loadModePrompt = (name: string, commandsDir: string): string => {
  const content = readFileSync(path.resolve(commandsDir, `${name}.md`), 'utf-8');
  return extractModeSection(content);
};

const loadCached = memoize((cacheKey: string): string => {
  const sep = cacheKey.indexOf('\0');
  const commandsDir = cacheKey.slice(0, sep);
  const name = cacheKey.slice(sep + 1);
  try {
    return loadModePrompt(name, commandsDir);
  } catch (error) {
    console.warn(`[maestria] Failed to load mode prompt "${name}":`, error);
    return '';
  }
});

/** Full mode prompt (marker plus body) for a keyword. */
export const getModePrompt = (keyword: ModeKeyword, commandsDir: string): string => {
  const cacheKey = `${path.resolve(commandsDir)}\0${keyword}`;
  return `${MODE_MARKERS[keyword]}\n\n${loadCached(cacheKey)}`;
};

// ── Keyword detection ──

/** Result of detecting a mode keyword in text. */
export interface ModeDetectResult {
  /** The detected keyword. */
  keyword: ModeKeyword;
  /** The text with the keyword stripped and trimmed. */
  strippedText: string;
  /** The full mode prompt (marker + body). */
  prompt: string;
}

/**
 * Detect a mode keyword in text. Pure detection lives in shared-mode;
 * unclosed-fence behavior follows ADR-OC-003 and `disabled` mirrors
 * OpenCode's disabled-keyword support. Prompt loading reads `commandsDir`.
 */
export const detectModeInText = (
  text: string,
  commandsDir: string,
  disabled?: Set<string>,
): ModeDetectResult | null => {
  if (!text) {
    return null;
  }

  const pure = sharedDetectMode(text, disabled);
  if (pure === null) {
    return null;
  }

  const strippedText = sharedStripKeyword(text, pure);

  return {
    keyword: pure.mode,
    prompt: getModePrompt(pure.mode, commandsDir),
    strippedText,
  };
};

/** Final LLM text: prompt plus stripped text, or just the prompt when empty. */
export const buildModeText = (prompt: string, strippedText: string): string =>
  strippedText ? `${prompt}\n\n${strippedText}` : prompt;

/** Install an input handler that detects mode keywords and injects the prompt. */
export const installModeAutoDetect = <Context, Result>(
  onInput: (handler: (event: { text: string }, ctx: Context) => Promise<Result>) => void,
  state: MaestriaState,
  commandsDir: string,
  opts: {
    /** Exit review mode. */
    restoreOriginalState: (ctx: Context) => Promise<boolean>;
    /** Persist state after mode change. */
    persistState: () => void;
    /** Return value when no keyword is detected. */
    noMatch: Result;
    /** Build return value from transformed text. */
    transform: (text: string) => Result;
  },
): void => {
  onInput(async (event, ctx) => {
    const { text } = event;
    const result = detectModeInText(text, commandsDir);
    if (!result) {
      return opts.noMatch;
    }

    if (state.reviewMode && !(await opts.restoreOriginalState(ctx))) {
      return opts.noMatch;
    }

    state.mode = result.keyword;
    opts.persistState();

    return opts.transform(buildModeText(result.prompt, result.strippedText));
  });
};

/** Install fein/sonar/blitz slash commands that set the workflow mode. */
export interface ModeCommandContext {
  ui: { notify: (msg: string) => void };
}

export const installModeCommands = <Context extends ModeCommandContext>(
  registerCommand: (
    name: string,
    options: {
      description: string;
      handler: (args: string, ctx: Context) => Promise<void> | void;
    },
  ) => void,
  state: MaestriaState,
  opts: {
    /** Exit review mode before switching modes. */
    restoreOriginalState: (ctx: Context) => Promise<boolean>;
    /** Persist state after mode change. */
    persistState: () => void;
  },
): void => {
  registerCommand(MODE_CLEAR_COMMAND, {
    description: 'Clear workflow mode and return to neutral routing',
    handler: async (_args: string, ctx: Context) => {
      if (state.reviewMode && !(await opts.restoreOriginalState(ctx))) {
        return;
      }
      state.mode = null;
      opts.persistState();
      ctx.ui.notify('Workflow mode cleared. Neutral routing is active.');
    },
  });

  for (const keyword of MODE_KEYWORDS) {
    registerCommand(keyword, {
      description: `Set workflow mode to ${keyword}`,
      handler: async (_args: string, ctx: Context) => {
        if (state.reviewMode && !(await opts.restoreOriginalState(ctx))) {
          return;
        }

        state.mode = keyword;
        opts.persistState();

        ctx.ui.notify(`Mode set to ${keyword}. Describe what you'd like to work on.`);
      },
    });
  }
};
