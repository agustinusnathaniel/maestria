import { readFileSync } from 'node:fs';
import path from 'node:path';
import { COMMANDS_DIR } from '@/root.js';
import {
  extractModeSection,
  isModeKeyword,
  getModeMarker as sharedGetMarker,
} from '@maestria/shared-mode';
import type { ModeKeyword } from '@/modes/types.js';

const VALID_KEYWORDS: readonly ModeKeyword[] = ['fein', 'sonar', 'blitz'];

const loadModePrompt = (name: string): string => {
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
const promptTarget: Record<string, string> = {};

export const MODE_PROMPTS: Record<ModeKeyword, string> = new Proxy(promptTarget, {
  get(target, key, receiver) {
    if (typeof key === 'string' && isModeKeyword(key)) {
      if (!(key in target)) {
        try {
          target[key] = loadModePrompt(key);
        } catch (error) {
          console.warn(`[maestria] Failed to load mode prompt "${key}":`, error);
          target[key] = '';
        }
      }
      return target[key];
    }
    return Reflect.get(target, key, receiver) as unknown;
  },
});

/**
 * Marker strings for each mode keyword, used to signal the active mode.
 * Format: `[MODE: <keyword>]`
 */
export const MODE_MARKERS: Record<ModeKeyword, string> = {
  blitz: '[MODE: blitz]',
  fein: '[MODE: fein]',
  sonar: '[MODE: sonar]',
};

export const getModePrompt = (keyword: string): string => {
  if (!isModeKeyword(keyword)) {
    return '';
  }
  return MODE_PROMPTS[keyword];
};

export const getModeMarker = (keyword: string): string => {
  if (!isModeKeyword(keyword)) {
    return '';
  }
  return sharedGetMarker(keyword);
};

/**
 * Array of all valid mode keywords for runtime iteration.
 */
export { VALID_KEYWORDS };
