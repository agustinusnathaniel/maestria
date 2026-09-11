import {
  isModeKeyword,
  detectMode as sharedDetectMode,
  getModeMarker as sharedGetMarker,
  stripKeyword as sharedStripKeyword,
} from '@maestria/shared-mode';

import { MODE_PROMPTS } from '@/modes/prompts.js';
import type { ModeResult } from '@/modes/types.js';

/**
 * Detect a workflow mode keyword in the given text.
 *
 * Delegates pure detection (word-boundary, priority, code-block
 * exclusion, disabled-keyword handling, case-insensitivity) to
 * `@maestria/shared-mode` and augments with prompt/marker so the
 * existing public API and result shape are preserved.
 *
 * Behavior (per ADR-OC-003) is unchanged: most restrictive wins
 * (fein > sonar > blitz), code spans are excluded, unclosed fences
 * are not excluded (accepted false-positive).
 */
export const detectMode = (text: string, disabled?: Set<string>): ModeResult | null => {
  const pure = sharedDetectMode(text, disabled);
  if (pure === null) {
    return null;
  }
  return {
    index: pure.index,
    keyword: pure.keyword,
    marker: sharedGetMarker(pure.mode),
    mode: pure.mode,
    prompt: MODE_PROMPTS[pure.mode],
  };
};

/**
 * Remove the matched keyword from the text, cleaning up any trailing colon
 * or whitespace that may follow it.
 */
export const stripKeyword = (text: string, result: ModeResult): string =>
  sharedStripKeyword(text, result);

/**
 * Get the mode prompt text for a given mode name.
 */
export const getModePrompt = (mode: string): string => {
  if (isModeKeyword(mode)) {
    return MODE_PROMPTS[mode];
  }
  return '';
};

/**
 * Get the mode marker string for a given mode name.
 */
export const getModeMarker = (mode: string): string => sharedGetMarker(mode);
