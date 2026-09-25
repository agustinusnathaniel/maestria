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
import { readSyncedMarkdown } from '@/markdown.js';

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
 * Missing or unreadable prompt files cache to '' (never throws).
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
  // readSyncedMarkdown warns and returns null when the file is missing, so a
  // missing prompt caches to '' without throwing.
  const content = readSyncedMarkdown(path.join(COMMANDS_DIR, `${keyword}.md`), 'mode prompt');
  const prompt = content === null ? '' : extractModeSection(content);
  promptCache[keyword] = prompt;
  return prompt;
};

// Pure detection (word-boundary, priority, code-block exclusion, disabled
// keywords, case-insensitivity) is delegated to `@maestria/shared-mode`;
// this wrapper augments with prompt/marker. Most restrictive wins
// (fein > sonar > blitz) per ADR-OC-003.
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
