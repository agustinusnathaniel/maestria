// packages/pi/sync.config.ts
// Sync config: generates pi-subagents agent .md files from canonical core directives.
//
// Each canonical specialist prompt is wrapped in pi-subagents YAML frontmatter
// (description, tools, prompt_mode, inherit_context) and output to the agents/
// directory. These files are deployed to ~/.pi/agent/agents/ at extension startup
// where pi-subagents discovers them as registered agent types.
//
// Only orchestrator.md goes to .sync-temp/ (it's handled by sync-skills.config.ts
// as a Pi skill for auto-injection into every session).

import type { SyncConfig } from '../core/scripts/lib/config.js';

export default {
  source: '../core/agent-directives/specialists',
  output: 'agents',

  default: {
    stripFrontmatter: true,
    replace: [
      { from: '@adventurer', to: '/adventurer' },
      { from: '@architect', to: '/architect' },
      { from: '@builder', to: '/builder' },
      { from: '@diagnose', to: '/diagnose' },
      { from: '@planner', to: '/planner' },
      { from: '@reviewer', to: '/reviewer' },
      { from: '@writer', to: '/writer' },
      { from: 'task(', to: 'maestria_subagent(' },
      { from: '@orchestrator', to: '/orchestrator' },
    ],
  },

  files: {
    // Redirect orchestrator to temp (handled by sync-skills.config.ts as a skill)
    'orchestrator.md': {
      output: '../.sync-temp/agents/orchestrator.md',
    },

    // 7 specialist agents with pi-subagents-compatible frontmatter
    // Each uses prompt_mode: append so the role-specific prompt merges on top
    // of the inherited orchestrator prompt from the parent session.
    // inherit_context: true passes the parent's system prompt to the subagent.

    'adventurer.md': {
      prepend:
        '---\n' +
        'description: >-\n' +
        '  Codebase reconnaissance specialist. Maps unknown territory, traces\n' +
        '  call chains and dependencies, discovers module relationships, and\n' +
        '  produces structured recon reports for downstream specialists.\n' +
        'tools: read, bash, grep, find, ls, glob\n' +
        'prompt_mode: append\n' +
        'inherit_context: true\n' +
        '---\n' +
        '\n',
    },

    'architect.md': {
      prepend:
        '---\n' +
        'description: >-\n' +
        '  Architecture decision specialist. Evaluates implementation approaches\n' +
        '  with trade-off analysis, produces Architecture Decision Records (ADRs),\n' +
        '  and documents technical decisions with business context.\n' +
        'tools: read, bash, grep, find, ls\n' +
        'prompt_mode: append\n' +
        'inherit_context: true\n' +
        '---\n' +
        '\n',
    },

    'builder.md': {
      prepend:
        '---\n' +
        'description: >-\n' +
        '  Focused implementation specialist. Executes one atomic, verifiable\n' +
        '  unit of work per invocation with minimal context and clean diffs.\n' +
        'tools: read, bash, grep, find, ls, write, edit\n' +
        'prompt_mode: append\n' +
        'inherit_context: true\n' +
        '---\n' +
        '\n',
    },

    'diagnose.md': {
      prepend:
        '---\n' +
        'description: >-\n' +
        '  Systematic bug tracing specialist. Follows a 6-step regression protocol\n' +
        '  from error message to root cause to prevention, covering blast radius\n' +
        '  and similar-problem scanning.\n' +
        'tools: read, bash, grep, find, ls\n' +
        'prompt_mode: append\n' +
        'inherit_context: true\n' +
        '---\n' +
        '\n',
    },

    'planner.md': {
      prepend:
        '---\n' +
        'description: >-\n' +
        '  Implementation planning specialist. Breaks complex features into\n' +
        '  phased milestones with dependencies, timelines, verification criteria,\n' +
        '  and rollback points.\n' +
        'tools: read, bash, grep, find, ls\n' +
        'prompt_mode: append\n' +
        'inherit_context: true\n' +
        '---\n' +
        '\n',
    },

    'reviewer.md': {
      prepend:
        '---\n' +
        'description: >-\n' +
        '  Code review specialist. Reviews for correctness, edge cases, security,\n' +
        '  performance, and maintainability. Supports multi-lens review swarms\n' +
        '  with fix/dismiss/escalate triage.\n' +
        'tools: read, bash, grep, find, ls, glob\n' +
        'prompt_mode: append\n' +
        'inherit_context: true\n' +
        '---\n' +
        '\n',
    },

    'writer.md': {
      prepend:
        '---\n' +
        'description: >-\n' +
        '  Documentation specialist. Creates clear, structured documentation\n' +
        '  following progressive disclosure patterns for READMEs, API docs,\n' +
        '  changelogs, and Architecture Decision Records.\n' +
        'tools: read, bash, grep, find, ls, write, edit\n' +
        'prompt_mode: append\n' +
        'inherit_context: true\n' +
        '---\n' +
        '\n',
    },
  },

  preserve: ['.gitkeep'],
} satisfies SyncConfig;
