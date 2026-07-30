import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { COMMANDS_DIR } from '@/root.js';

export const MODE_MARKERS: Record<string, string> = {
  fein: '[MODE: fein]',
  sonar: '[MODE: sonar]',
  blitz: '[MODE: blitz]',
};

const promptCache = new Map<string, string>();

function loadModePrompt(keyword: string): string {
  const cached = promptCache.get(keyword);
  if (cached) return cached;

  const path = join(COMMANDS_DIR, `${keyword}.md`);
  if (!existsSync(path)) {
    const msg = `[maestria] Mode prompt not found: ${path}`;
    console.warn(msg);
    promptCache.set(keyword, '');
    return '';
  }

  const content = readFileSync(path, 'utf-8');
  // Extract text from after "## MODE:" heading to end of file
  const modeMatch = content.match(/## MODE:[\s\S]*?(?=\n#|$)/);
  const prompt = modeMatch ? modeMatch[0].trim() : content.trim();
  promptCache.set(keyword, prompt);
  return prompt;
}

export function getModePrompt(keyword: string): string {
  return loadModePrompt(keyword);
}

export function getModeMarker(keyword: string): string {
  return MODE_MARKERS[keyword] ?? `[MODE: ${keyword}]`;
}
