import { readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import {
  extractModeSection,
  getModeMarker,
  isModeKeyword,
  MODE_KEYWORDS,
  detectMode as sharedDetect,
} from '@maestria/shared-mode';
import type { ModeDetectPure } from '@maestria/shared-mode';
import { COMMANDS_DIR } from '@/root.js';

// Single source for allowed keywords: @maestria/shared-mode owns the list,
// this zod schema enforces it at the host-options trust boundary.
export const modeKeywordSchema = z.enum(MODE_KEYWORDS);
export type ModeKeyword = z.infer<typeof modeKeywordSchema>;

export const maestriaOptionsSchema = z.object({
  modes: z
    .object({
      disabledKeywords: z.array(modeKeywordSchema).optional(),
    })
    .optional(),
});
export type MaestriaPluginOptions = z.infer<typeof maestriaOptionsSchema>;

export interface ModeResult extends ModeDetectPure {
  prompt: string;
  marker: string;
}

/**
 * Mode prompt text for each keyword, lazily loaded on first access.
 * If a prompt file is missing or unreadable, logs a warning and caches
 * an empty string - never throws at module evaluation time.
 *
 * @see ADR-OC-003 (section "Mode Prompts")
 */
const promptCache: Partial<Record<ModeKeyword, string>> = {};

export const getModePrompt = (keyword: string): string => {
  if (!isModeKeyword(keyword)) {
    return '';
  }
  const cached = promptCache[keyword];
  if (cached !== undefined) {
    return cached;
  }
  try {
    const content = readFileSync(path.resolve(COMMANDS_DIR, `${keyword}.md`), 'utf-8');
    const prompt = extractModeSection(content);
    promptCache[keyword] = prompt;
    return prompt;
  } catch (error) {
    console.warn(`[maestria] Failed to load mode prompt "${keyword}":`, error);
    promptCache[keyword] = '';
    return '';
  }
};

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
