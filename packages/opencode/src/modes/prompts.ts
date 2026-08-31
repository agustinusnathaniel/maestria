import { extractModeSection } from '@maestria/shared-mode';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { ModeKeyword } from '@/modes/types.js';
import { COMMANDS_DIR } from '@/root.js';

const VALID_KEYWORDS: readonly ModeKeyword[] = ['fein', 'sonar', 'blitz'];

const loadModePrompt = (name: string): string => {
  const content = readFileSync(path.resolve(COMMANDS_DIR, `${name}.md`), 'utf-8');
  return extractModeSection(content);
};

const isModeKeyword = (value: string): value is ModeKeyword =>
  VALID_KEYWORDS.some((keyword) => keyword === value);

const modePromptTarget: Record<string, string> = {};

/**
 * Mode prompt text for each keyword, lazily loaded on first access.
 * If a prompt file is missing or unreadable, logs a warning and caches
 * an empty string - never throws at module evaluation time.
 *
 * @see ADR-OC-003 (section "Mode Prompts")
 */
export const MODE_PROMPTS: Record<ModeKeyword, string> = new Proxy(modePromptTarget, {
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

/**
 * Array of all valid mode keywords for runtime iteration.
 */
export { VALID_KEYWORDS };
