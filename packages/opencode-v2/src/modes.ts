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

export const getModePrompt = (keyword: string): string => {
  if (!isModeKeyword(keyword)) {
    return '';
  }
  const content = readSyncedMarkdown(path.join(COMMANDS_DIR, `${keyword}.md`), 'mode prompt');
  return content === null ? '' : extractModeSection(content);
};

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
