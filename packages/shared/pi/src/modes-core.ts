/**
 * Shared mode constants and utilities for Maestria platform packages.
 *
 * Pure TypeScript — no platform-specific dependencies.
 * Imported by both @maestria/omp and @maestria/pi to eliminate duplication
 * in mode prompt loading, keyword detection, and text transformation.
 *
 * @module
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { MaestriaState } from './state-core.js';

// ── Constants ──

export const MODE_KEYWORDS = ['fein', 'sonar', 'blitz'] as const;
export const MODE_CLEAR_COMMAND = 'mode-clear';
export type ModeKeyword = (typeof MODE_KEYWORDS)[number];

export const MODE_MARKERS: Record<ModeKeyword, string> = {
  fein: '[MODE: fein]',
  sonar: '[MODE: sonar]',
  blitz: '[MODE: blitz]',
};

// ── Prompt loading ──

/** Lazily cached mode prompts — shared across platforms. */
const _promptCache: Partial<Record<ModeKeyword, string>> = {};

/**
 * Load and cache a mode prompt from a commands directory.
 * The commandsDir should point to a directory containing `fein.md`,
 * `sonar.md`, and `blitz.md` files.
 */
export function loadModePrompt(name: string, commandsDir: string): string {
  const content = readFileSync(resolve(commandsDir, `${name}.md`), 'utf-8');
  const modeIdx = content.indexOf('## MODE:');
  if (modeIdx !== -1) {
    return content.slice(modeIdx).replace(/\s+$/, '') + '\n';
  }
  return content.replace(/\s+$/, '') + '\n';
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

/** Regex matching fenced code blocks (```) and inline backtick spans (`). */
const CODE_BLOCK_RE = /```[\s\S]*?```|`[^`]*`/g;

/**
 * Find ranges of fenced code blocks and inline code spans in text.
 * Returns [start, end) positions. Keywords inside these ranges are
 * ignored during detection (per ADR-OC-003).
 */
function findAllCodeBlockRanges(text: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  let match: RegExpExecArray | null;
  while ((match = CODE_BLOCK_RE.exec(text)) !== null) {
    ranges.push([match.index, match.index + match[0].length]);
  }
  return ranges;
}

function isInRanges(index: number, ranges: Array<[number, number]>): boolean {
  return ranges.some(([start, end]) => index >= start && index < end);
}

/**
 * Priority mapping for mode keyword restrictiveness.
 * Higher number = more restrictive = wins when multiple keywords are present.
 * fein (3): full pipeline with mandatory gates
 * sonar (2): research only, no code
 * blitz (1): fast implementation, skip optional ceremony; required review remains
 */
const MODE_PRIORITY: Record<ModeKeyword, number> = {
  fein: 3,
  sonar: 2,
  blitz: 1,
};

/**
 * Detect a mode keyword (fein/sonar/blitz) in text as a whole word,
 * case-insensitive. Detection rules (per ADR-OC-003):
 * - Word-boundary regex matching (\bfein\b, \bsonar\b, \bblitz\b)
 * - Most restrictive match wins (fein > sonar > blitz)
 * - Case-insensitive
 * - Matches inside fenced code blocks (```) and inline backticks (`) are ignored
 */
export function detectModeInText(text: string, commandsDir: string): ModeDetectResult | null {
  if (!text) return null;

  const codeRanges = findAllCodeBlockRanges(text);
  let best: { keyword: ModeKeyword; index: number } | null = null;

  for (const keyword of MODE_KEYWORDS) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      if (isInRanges(match.index, codeRanges)) continue;
      // Most-restrictive wins: prefer higher-priority mode over position
      if (best === null || MODE_PRIORITY[keyword] > MODE_PRIORITY[best.keyword]) {
        best = { keyword, index: match.index };
      }
    }
  }

  if (best === null) return null;

  // Strip the matched keyword, cleaning up a trailing colon and collapsing
  // double spaces (mirrors opencode's stripKeyword behavior).
  const before = text.slice(0, best.index);
  const after = text.slice(best.index + best.keyword.length).replace(/^:\s*/, '');
  const strippedText = (before + after).replace(/ {2,}/g, ' ').trim();

  return {
    keyword: best.keyword,
    strippedText,
    prompt: getModePrompt(best.keyword, commandsDir),
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
 *
 * @param onInput - Platform's `pi.on('input', handler)` method
 * @param state - Shared maestria state
 * @param commandsDir - Path to directory containing fein.md/sonar.md/blitz.md
 * @param opts - Platform-specific callbacks and result builders
 */
export function installModeAutoDetect(
  onInput: (handler: (event: unknown, ctx: unknown) => unknown) => void,
  state: MaestriaState,
  commandsDir: string,
  opts: {
    /** Exit review mode — calls platform's restoreOriginalState */
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
 *
 * @param registerCommand - Platform's `pi.registerCommand(name, opts)` method
 * @param state - Shared maestria state
 * @param opts - Platform-specific callbacks
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
