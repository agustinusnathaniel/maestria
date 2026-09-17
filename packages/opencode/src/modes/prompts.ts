import { memoize } from 'es-toolkit';
import { extractModeSection, isModeKeyword } from '@maestria/shared-mode';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { ModeKeyword } from '@/modes/types.js';
import { COMMANDS_DIR } from '@/root.js';

const loadCached = memoize((name: string): string => {
  try {
    return extractModeSection(readFileSync(path.resolve(COMMANDS_DIR, `${name}.md`), 'utf-8'));
  } catch (error) {
    console.warn(`[maestria] Failed to load mode prompt "${name}":`, error);
    return '';
  }
});

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
      return loadCached(key);
    }
    return Reflect.get(target, key, receiver) as unknown;
  },
});
