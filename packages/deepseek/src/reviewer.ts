import type { Context } from '@deepseek-ai/cordis';
import type { SystemPrompt } from '@deepseek-ai/dsh-system-prompt';

import { readPrompt, RULES_ORDER } from './prompts.js';

/**
 * maestria plugin for the `maestria-reviewer` agent preset: the reviewer role as the
 * `maestria_reviewer` prompt variable and the rules every reviewer follows as a section.
 */
export const name = 'maestria-reviewer';

export const inject = ['systemPrompt'];

export const apply = (ctx: Context & { readonly systemPrompt: SystemPrompt }): void => {
  const reviewer = readPrompt('reviewer');
  ctx.systemPrompt.variable('maestria_reviewer', () => reviewer);
  ctx.systemPrompt.section({
    interpolate: false,
    name: 'maestria:reviewer-rules',
    order: RULES_ORDER,
    text: readPrompt('reviewer-rules'),
  });
};
