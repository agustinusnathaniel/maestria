import { detectMode as sharedDetect } from '@maestria/shared-mode';
import { getModeMarker, getModePrompt } from '@/modes/prompts.js';
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
  const pure = sharedDetect(text, disabled);
  if (pure === null) {
    return null;
  }
  return {
    index: pure.index,
    keyword: pure.keyword,
    marker: getModeMarker(pure.mode),
    mode: pure.mode,
    prompt: getModePrompt(pure.mode),
  };
};
