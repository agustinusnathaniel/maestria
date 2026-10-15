// packages/deepseek/sync.config.ts
// DeepSeek Harness projection: persona prompts for the Cordis plugin and the
// skills the `maestria` agent preset mounts, all derived from canonical core.
//
// - prompts/<role>.md: persona bodies the plugin registers as `maestria_<role>`
//   prompt variables; the orchestrator carries the DSH integration note.
// - prompts/global-rules.md: the system-prompt section every preset agent gets.
// - skills/: workflow modes plus the rules.md utility sections. The bundled
//   methodology skills are copied in by scripts/sync-bundled-skills.ts.

import { readFileSync } from 'node:fs';

import type { FileConfig, SyncConfig } from '../core/scripts/lib/config.js';
import { specialistReferenceReplacements } from '../core/scripts/lib/specialist-replacements.js';

const RULES = '../core/agent-directives/rules.md';

const integrationNote = readFileSync(
  new URL('../core/agent-directives/integrations/deepseek.md', import.meta.url),
  'utf-8',
);

const skill = (name: string, description: string, extra: FileConfig = {}): FileConfig => ({
  ...extra,
  frontmatter: { description, name },
  output: `../skills/${name}/SKILL.md`,
});

export default {
  default: {
    // `@builder` becomes `maestria_builder`, the preset's delegation tool name.
    replace: specialistReferenceReplacements('maestria_'),
    stripFrontmatter: true,
  },
  files: {
    'commands/blitz.md': skill(
      'blitz',
      'Fast capability-aware workflow mode that skips optional ceremony without waiving safety or review.',
    ),
    'commands/fein.md': skill(
      'fein',
      'Full workflow mode for reconnaissance or design, implementation, and independent review.',
    ),
    'commands/sonar.md': skill(
      'sonar',
      'Research-only workflow mode for read-only specialist work that stops before implementation.',
    ),
    handoff: skill(
      'handoff',
      'Pass outcome, constraints, evidence, blockers, and next steps between workflow stages. Load when receiving a task from another specialist, or when handing off work to the next stage.',
      { section: 'Delegation and Context', source: RULES },
    ),
    'iteration-limits': skill(
      'iteration-limits',
      'The iteration-limit pattern with verifiable termination and escalation format. Load when defining termination conditions for a loop, or when a loop risks running too long.',
      { section: 'Bounded Repair and Fail-Loud Behavior', source: RULES },
    ),
    'orchestrator.md': { append: `\n${integrationNote}` },
    'rules.md': { output: 'global-rules.md' },
  },
  output: 'prompts',
  source: '../core/agent-directives/specialists',
} satisfies SyncConfig;
