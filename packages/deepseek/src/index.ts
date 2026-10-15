import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { Context } from '@deepseek-ai/cordis';
import type { SystemPrompt } from '@deepseek-ai/dsh-system-prompt';

/**
 * maestria methodology plugin for DeepSeek Harness, mounted by the bundle's
 * `maestria` agent preset. It registers one `maestria_<role>` prompt variable
 * per persona, which the preset's persona and delegation rows reference, and
 * the global rules as a system-prompt section.
 */
export const name = 'maestria';

export const inject = ['systemPrompt'];

export const PERSONAS = [
  'orchestrator',
  'adventurer',
  'architect',
  'builder',
  'diagnose',
  'planner',
  'reviewer',
  'writer',
] as const;

const PROMPTS_DIR = path.resolve(import.meta.dirname, '../prompts');

/** Generated prompt text without its provenance banner. Reads at mount, so a missing file fails the preset. */
const readPrompt = (file: string): string =>
  readFileSync(path.join(PROMPTS_DIR, `${file}.md`), 'utf-8')
    .replace(/^\s*<!--[\s\S]*?-->/u, '')
    .trim();

/** The host provides `systemPrompt` (`inject`); the package imports host types only. */
export const apply = (ctx: Context & { readonly systemPrompt: SystemPrompt }): void => {
  for (const persona of PERSONAS) {
    const text = readPrompt(persona);
    ctx.systemPrompt.variable(`maestria_${persona}`, () => text);
  }
  ctx.systemPrompt.section({
    // Literal text: the rules are prose, not a `{{variable}}` template.
    interpolate: false,
    name: 'maestria:global-rules',
    order: 150,
    text: readPrompt('global-rules'),
  });
};
