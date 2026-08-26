/**
 * Shared mode constants and utilities for Maestria Pi-family packages.
 *
 * Delegates pure mechanics to `@maestria/shared-mode` while preserving
 * host-specific concerns: lazy prompt loading from `commandsDir`,
 * session-state side effects, and platform handler factories.
 *
 * @module
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  MODE_KEYWORDS as SHARED_KEYWORDS,
  MODE_MARKERS as SHARED_MARKERS,
  extractModeSection,
  detectMode as sharedDetectMode,
  stripKeyword as sharedStripKeyword,
} from '@maestria/shared-mode';
import type { ModeKeyword as SharedModeKeyword } from '@maestria/shared-mode';
import type { MaestriaState } from './state-core.js';

// ── Constants (re-exported from shared-mode to preserve public API) ──

export const MODE_KEYWORDS = SHARED_KEYWORDS;
export const MODE_CLEAR_COMMAND = 'mode-clear';
export type ModeKeyword = SharedModeKeyword;

export const MODE_MARKERS: Record<ModeKeyword, string> = SHARED_MARKERS;

// ── Prompt loading ──

/** Lazily cached mode prompts - shared across Pi-family. */
const _promptCache: Partial<Record<ModeKeyword, string>> = {};

/**
 * Load and cache a mode prompt from a commands directory.
 * Delegates `## MODE:` extraction to the neutral shared-mode helper.
 */
export function loadModePrompt(name: string, commandsDir: string): string {
  const content = readFileSync(resolve(commandsDir, `${name}.md`), 'utf-8');
  return extractModeSection(content);
}

/**
 * Get the full mode prompt (marker + body) for a keyword, loading from
 * the given commands directory on first access.
 */
export function getModePrompt(keyword: ModeKeyword, commandsDir: string): string {
  if (!(keyword in _promptCache)) {
    try {
      _promptCache[keyword] = loadModePrompt(keyword, commandsDir);
    } catch (e) {
      console.warn(`[maestria] Failed to load mode prompt "${keyword}":`, e);
      _promptCache[keyword] = '';
    }
  }
  return `${MODE_MARKERS[keyword]}\n\n${_promptCache[keyword]}`;
}

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
 * Detect a mode keyword (fein/sonar/blitz) in text as a whole word,
 * case-insensitive. Delegates pure detection (including code-block
 * exclusion, word-boundary, priority, and case-insensitivity) to
 * `@maestria/shared-mode`. The accepted unclosed-fence behavior
 * (ADR-OC-003) is preserved via the shared helper.
 *
 * Lazy prompt loading remains host-specific (reads `commandsDir`).
 * Optional `disabled` set mirrors OpenCode's disabled-keyword support.
 */
export function detectModeInText(
  text: string,
  commandsDir: string,
  disabled?: Set<string>,
): ModeDetectResult | null {
  if (!text) return null;

  const pure = sharedDetectMode(text, disabled);
  if (pure === null) return null;

  const strippedText = sharedStripKeyword(text, pure);

  return {
    keyword: pure.mode,
    strippedText,
    prompt: getModePrompt(pure.mode, commandsDir),
  };
}

/**
 * Build the final text to send to the LLM: prompt + stripped text.
 * If strippedText is empty, returns just the prompt.
 */
export function buildModeText(prompt: string, strippedText: string): string {
  return strippedText ? `${prompt}\n\n${strippedText}` : prompt;
}

// ── Platform handler factories ──

/**
 * Install an input event handler that detects mode keywords (fein/sonar/blitz)
 * in user input, strips them, and injects the mode prompt.
 */
export function installModeAutoDetect(
  onInput: (handler: (event: unknown, ctx: unknown) => unknown) => void,
  state: MaestriaState,
  commandsDir: string,
  opts: {
    /** Exit review mode - calls platform's restoreOriginalState */
    restoreOriginalState: (ctx: unknown) => Promise<void>;
    /** Persist state after mode change */
    persistState: () => void;
    /** Return value when no keyword is detected (e.g. Pi: { action: 'continue' }) */
    noMatch: unknown;
    /** Build return value from transformed text (e.g. Pi: { action: 'transform', text }) */
    transform: (text: string) => unknown;
  },
): void {
  onInput(async (event: unknown, ctx: unknown) => {
    const text = ((event as Record<string, unknown>).text as string) ?? '';
    const result = detectModeInText(text, commandsDir);
    if (!result) return opts.noMatch;

    if (state.reviewMode) {
      await opts.restoreOriginalState(ctx);
    }

    state.mode = result.keyword;
    opts.persistState();

    return opts.transform(buildModeText(result.prompt, result.strippedText));
  });
}

/**
 * Install slash commands for fein/sonar/blitz that set the workflow mode
 * and show a notification. Task description injection is handled by the
 * auto-detect handler instead.
 */
export function installModeCommands(
  registerCommand: (
    name: string,
    options: { description: string; handler: (...args: unknown[]) => unknown },
  ) => void,
  state: MaestriaState,
  opts: {
    /** Exit review mode before switching modes */
    restoreOriginalState: (ctx: unknown) => Promise<void>;
    /** Persist state after mode change */
    persistState: () => void;
  },
): void {
  registerCommand(MODE_CLEAR_COMMAND, {
    description: 'Clear workflow mode and return to neutral routing',
    handler: async (_args: unknown, ctx: unknown) => {
      if (state.reviewMode) {
        await opts.restoreOriginalState(ctx);
      }
      state.mode = null;
      opts.persistState();
      ((ctx as Record<string, unknown>).ui as { notify: (msg: string) => void }).notify(
        'Workflow mode cleared. Neutral routing is active.',
      );
    },
  });

  for (const keyword of MODE_KEYWORDS) {
    registerCommand(keyword, {
      description: `Set workflow mode to ${keyword}`,
      handler: async (_args: unknown, ctx: unknown) => {
        if (state.reviewMode) {
          await opts.restoreOriginalState(ctx);
        }

        state.mode = keyword;
        opts.persistState();

        ((ctx as Record<string, unknown>).ui as { notify: (msg: string) => void }).notify(
          `Mode set to ${keyword}. Describe what you'd like to work on.`,
        );
      },
    });
  }
}
