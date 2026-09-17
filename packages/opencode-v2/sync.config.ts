// packages/opencode-v2/sync.config.ts
// Sync config: derives opencode-v2 agent files from canonical core directives
//
// oxlint-disable sort-keys -- Key order here is declarative (source/output/default/files);
// `check-sync` enforces byte identity of the generated agent frontmatter, so keys stay
// in logical order instead of sorted order.

import type { SyncConfig } from '../core/scripts/lib/config.js';

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
    // 7 specialists - mode: subagent
    'adventurer.md': {
      frontmatter: {
        description: 'Codebase reconnaissance, deep code understanding',
        mode: 'subagent',
      },
    },
    'architect.md': {
      frontmatter: {
        description: 'Architecture decisions, trade-off analysis, ADRs',
        mode: 'subagent',
      },
    },
    'builder.md': {
      frontmatter: {
        description: 'Focused implementation, single-task execution',
        mode: 'subagent',
      },
    },
    'diagnose.md': {
      frontmatter: {
        description: 'Systematic bug tracing, root cause analysis',
        mode: 'subagent',
      },
    },
    'planner.md': {
      frontmatter: {
        description: 'Implementation plans with phased milestones',
        mode: 'subagent',
      },
    },
    'reviewer.md': {
      frontmatter: {
        description: 'Code review with quality gates',
        mode: 'subagent',
      },
    },
    'writer.md': {
      frontmatter: {
        description: 'Documentation following structured patterns',
        mode: 'subagent',
      },
    },

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
