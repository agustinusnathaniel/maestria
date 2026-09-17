// packages/opencode-v2/sync.config.ts
// Sync config: derives opencode-v2 agent files from canonical core directives
//
// oxlint-disable sort-keys -- Key order here is declarative (source/output/default/files);
// `check-sync` enforces byte identity of the generated agent frontmatter, so keys stay
// in logical order instead of sorted order.

import type { SyncConfig } from '../core/scripts/lib/config.js';

// 7 specialists (mode: subagent) synced from canonical core directives.
// Descriptions here become the generated agents/ frontmatter.
const SPECIALIST_DESCRIPTIONS = {
  adventurer: 'Codebase reconnaissance, deep code understanding',
  architect: 'Architecture decisions, trade-off analysis, ADRs',
  builder: 'Focused implementation, single-task execution',
  diagnose: 'Systematic bug tracing, root cause analysis',
  planner: 'Implementation plans with phased milestones',
  reviewer: 'Code review with quality gates',
  writer: 'Documentation following structured patterns',
} as const;

const specialistEntries = Object.fromEntries(
  Object.entries(SPECIALIST_DESCRIPTIONS).map(([name, description]) => [
    `${name}.md`,
    { frontmatter: { description, mode: 'subagent' } },
  ]),
);

export default {
  source: '../core/agent-directives/specialists',
  output: 'agents',

  default: {
    stripFrontmatter: true,
    replace: [],
  },

  files: {
    // Orchestrator - mode: all (the router)
    'orchestrator.md': {
      frontmatter: {
        description:
          'Routes each turn to direct, focused, or full execution; delegates to specialists; manages commit protocol',
        mode: 'all',
      },
    },
    ...specialistEntries,

    // 3 workflow commands from ../core/agent-directives/commands/
    // Resolved via secondary source loop (dirname(source) = ../core/agent-directives/)
    'commands/fein.md': {
      output: 'commands/fein.md',
      stripFrontmatter: true,
    },
    'commands/sonar.md': {
      output: 'commands/sonar.md',
      stripFrontmatter: true,
    },
    'commands/blitz.md': {
      output: 'commands/blitz.md',
      stripFrontmatter: true,
    },

    // Global rules from ../core/agent-directives/rules.md
    // Resolved via secondary source loop
    'rules.md': {
      output: '../rules/AGENTS.md',
      stripFrontmatter: true,
    },
  },

  preserve: ['.gitkeep'],
} satisfies SyncConfig;
