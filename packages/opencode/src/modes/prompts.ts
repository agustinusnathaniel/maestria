import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ModeKeyword } from '@/modes/types.js';

/** Walk up from the module's directory to find the package root (where package.json lives). */
function findPackageRoot(fromUrl: string): string | null {
  let dir = dirname(fileURLToPath(fromUrl));
  while (true) {
    if (existsSync(join(dir, 'package.json'))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }
  return null;
}

const pkgRoot = findPackageRoot(import.meta.url);
if (!pkgRoot) throw new Error('Could not find @maestria/opencode package root');
const COMMANDS_DIR = join(pkgRoot, 'agents', 'commands');

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
