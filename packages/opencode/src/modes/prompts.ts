import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { COMMANDS_DIR } from '@/root.js';
import type { ModeKeyword } from '@/modes/types.js';

const VALID_KEYWORDS: readonly ModeKeyword[] = ['fein', 'sonar', 'blitz'];

function loadModePrompt(name: string): string {
  const content = readFileSync(resolve(COMMANDS_DIR, `${name}.md`), 'utf-8');
  // Find the `## MODE:` heading which marks the start of the actual prompt text.
  // The synced command files start with an HTML comment (`<!-- Auto-generated... -->`),
  // not YAML frontmatter (`---`), so a frontmatter regex would never match.
  const modeIdx = content.indexOf('## MODE:');
  if (modeIdx !== -1) {
    return content.slice(modeIdx).replace(/\s+$/, '') + '\n';
  }
  return content.replace(/\s+$/, '') + '\n';
}

/**
 * Mode prompt text for each keyword, lazily loaded on first access.
 * If a prompt file is missing or unreadable, logs a warning and caches
 * an empty string — never throws at module evaluation time.
 *
 * @see ADR-OC-003 (section "Mode Prompts")
 */
export const MODE_PROMPTS: Record<ModeKeyword, string> = new Proxy(
  {} as Record<ModeKeyword, string>,
  {
    get(target, key, receiver) {
      if (typeof key === 'string' && (VALID_KEYWORDS as readonly string[]).includes(key)) {
        if (!(key in target)) {
          try {
            (target as Record<string, string>)[key] = loadModePrompt(key);
          } catch (e) {
            console.warn(`[maestria] Failed to load mode prompt "${key}":`, e);
            (target as Record<string, string>)[key] = '';
          }
        }
        return (target as Record<string, string>)[key as string];
      }
      return Reflect.get(target, key, receiver);
    },
  },
);

/**
 * Marker strings for each mode keyword, used to signal the active mode.
 * Format: `[MODE: <keyword>]`
 */
export const MODE_MARKERS: Record<ModeKeyword, string> = {
  fein: '[MODE: fein]',
  sonar: '[MODE: sonar]',
  blitz: '[MODE: blitz]',
};

/**
 * Array of all valid mode keywords for runtime iteration.
 */
export { VALID_KEYWORDS };
