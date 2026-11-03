// packages/deepseek/sync.config.ts
// DeepSeek Harness projection: the prompts the two Cordis plugins register and the mode skills
// the presets mount, all derived from canonical core. The method skills are copied in by
// scripts/sync-bundled-skills.ts.

import { readFileSync } from 'node:fs';

import { methodSkillBody } from '../core/scripts/lib/agent-directive-sync.js';
import type { FileConfig, SyncConfig } from '../core/scripts/lib/config.js';
import { specialistReferenceReplacements } from '../core/scripts/lib/specialist-replacements.js';

const RULES = '../core/agent-directives/rules.md';

const integrationNote = readFileSync(
  new URL('../core/agent-directives/integrations/deepseek.md', import.meta.url),
  'utf-8',
);

const modeSkill = (name: string, description: string): FileConfig => ({
  frontmatter: { description, name },
  output: `../skills/${name}/SKILL.md`,
});

export default {
  default: {
    // `@reviewer` becomes `maestria_reviewer`, the preset's review delegation tool.
    replace: specialistReferenceReplacements('maestria_'),
    stripFrontmatter: true,
  },
  files: {
    'commands/blitz.md': modeSkill(
      'blitz',
      'Fast capability-aware route - skip optional recon and design ceremony. Load when a message starts with the blitz keyword.',
    ),
    'commands/fein.md': modeSkill(
      'fein',
      'Full method - recon, design, implement, review. Load when a message starts with the fein keyword.',
    ),
    'commands/sonar.md': modeSkill(
      'sonar',
      'Research only - recon and architecture-plan in the main loop, STOP before implementation. Load when a message starts with the sonar keyword.',
    ),
    'main-loop.md': { append: `\n${integrationNote}` },
    'reviewer-rules.md': {
      section: [
        'Universal Floors',
        'Reporting',
        'Scope',
        'Authorization Stops',
        'Acceptance and Blind Review',
      ],
      source: RULES,
    },
    'reviewer.md': {
      // The reviewer embeds `implement`, so it reviews against the same judgment.
      append: `\n\n${methodSkillBody('implement')}`,
    },
    'rules.md': { source: RULES },
  },
  output: 'prompts',
  source: '../core/agent-directives/specialists',
} satisfies SyncConfig;
