import {
  detectMode as sharedDetectMode,
  stripKeyword as sharedStripKeyword,
  getModeMarker as sharedGetMarker,
} from '@maestria/shared-mode';
import { MODE_PROMPTS, MODE_MARKERS, VALID_KEYWORDS } from '@/modes/prompts.js';
import type { ModeKeyword, ModeResult } from '@/modes/types.js';

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
export function detectMode(text: string, disabled?: Set<string>): ModeResult | null {
  const pure = sharedDetectMode(text, disabled);
  if (pure === null) return null;
  return {
    mode: pure.mode,
    keyword: pure.keyword,
    index: pure.index,
    prompt: MODE_PROMPTS[pure.mode],
    marker: MODE_MARKERS[pure.mode],
  };
}

/**
 * Remove the matched keyword from the text, cleaning up any trailing colon
 * or whitespace that may follow it.
 */
export function stripKeyword(text: string, result: ModeResult): string {
  return sharedStripKeyword(text, result);
}

/**
 * Get the mode prompt text for a given mode name.
 */
export function getModePrompt(mode: string): string {
  if (isModeKeyword(mode)) {
    return MODE_PROMPTS[mode];
  }
  return '';
}

/**
 * Get the mode marker string for a given mode name.
 */
export function getModeMarker(mode: string): string {
  if (isModeKeyword(mode)) {
    return sharedGetMarker(mode);
  }
  return '';
}

function isModeKeyword(value: string): value is ModeKeyword {
  return (VALID_KEYWORDS as readonly string[]).includes(value);
}
