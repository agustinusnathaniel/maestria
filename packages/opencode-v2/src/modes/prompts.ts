import { readFileSync } from 'node:fs';
import path from 'node:path';
import { COMMANDS_DIR } from '@/root.js';
import {
  extractModeSection,
  isModeKeyword,
  getModeMarker as sharedGetMarker,
} from '@maestria/shared-mode';
import type { ModeKeyword } from '@/modes/types.js';

const loadModePrompt = (name: ModeKeyword): string => {
  const content = readFileSync(path.resolve(COMMANDS_DIR, `${name}.md`), 'utf-8');
  return extractModeSection(content);
};

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
    const prompt = loadModePrompt(keyword);
    promptCache[keyword] = prompt;
    return prompt;
  } catch (error) {
    console.warn(`[maestria] Failed to load mode prompt "${keyword}":`, error);
    promptCache[keyword] = '';
    return '';
  }
};

/**
 * Marker string for a mode keyword, used to signal the active mode.
 * Format: `[MODE: <keyword>]`
 */
export const getModeMarker = (keyword: string): string => {
  if (!isModeKeyword(keyword)) {
    return '';
  }
  return sharedGetMarker(keyword);
};
