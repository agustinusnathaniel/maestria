import { readFileSync } from 'node:fs';
import path from 'node:path';

const PROMPTS_DIR = path.resolve(import.meta.dirname, '../prompts');

/** Generated prompt text without its provenance banner. Reads at mount, so a missing file fails the preset. */
export const readPrompt = (name: string, dir = PROMPTS_DIR): string =>
  readFileSync(path.join(dir, `${name}.md`), 'utf-8')
    .replace(/^\s*<!--[\s\S]*?-->/u, '')
    .trim();

/** After the persona prefix and before every host policy section. */
export const RULES_ORDER = 150;
