import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ModeKeyword } from '@/modes/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMMANDS_DIR = resolve(__dirname, '../../agents/commands');

const FRONTMATTER_RE = /^---[\s\S]*?\n---\n*/;

function loadModePrompt(name: string): string {
  const content = readFileSync(resolve(COMMANDS_DIR, `${name}.md`), 'utf-8');
  return content.replace(FRONTMATTER_RE, '').replace(/\s+$/, '') + '\n';
}

/**
 * Mode prompt text for each keyword.
 * These are injected into the turn when a mode is detected.
 *
 * @see ADR-OC-003 (section "Mode Prompts")
 */
export const MODE_PROMPTS: Record<ModeKeyword, string> = {
  fein: loadModePrompt('fein'),
  sonar: loadModePrompt('sonar'),
  blitz: loadModePrompt('blitz'),
};

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
export const VALID_KEYWORDS: readonly ModeKeyword[] = ['fein', 'sonar', 'blitz'];
