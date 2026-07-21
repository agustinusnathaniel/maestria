// packages/pi/sync.config.ts
// Unified sync config: generates both pi-subagents agent files AND Pi skill files
// from canonical core directives in a single pass.
//
// - agents/*.md (7 specialists): deployed to ~/.pi/agent/agents/ for pi-subagents
// - skills/orchestrator/SKILL.md: Pi skill auto-injected into every session
// - skills/global-rules/SKILL.md: Pi skill auto-injected into every session

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
    // --- Pi-subagents agent types (7 specialists) ---
    // Each gets role-specific frontmatter with tool isolation

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

    // --- Pi skills (orchestrator + global rules) ---
    // Redirected to skills/ with Pi skill frontmatter

    'orchestrator.md': {
      output: '../skills/orchestrator/SKILL.md',
      prepend:
        '---\n' +
        'name: orchestrator\n' +
        'description: >-\n' +
        '  Maestria agent orchestration dispatcher. Delegates work to 7 specialist\n' +
        '  subagents (adventurer, architect, builder, diagnose, planner, reviewer, writer)\n' +
        '  using spec-driven handoffs. Enforces maker/checker split, commit protocol,\n' +
        '  and role-based pipeline sequencing.\n' +
        '---\n' +
        '\n',
    },

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

    // rules.md found via secondary source loop from dirname(source) = ../core/agent-directives/
    'rules.md': {
      output: '../skills/global-rules/SKILL.md',
      prepend:
        '---\n' +
        'name: global-rules\n' +
        'description: >-\n' +
        '  Global behavioral constraints and best practices for maestria-powered\n' +
        '  Pi agents. Covers orchestration conventions, delegation rules, context\n' +
        '  management, commit policy, pipeline patterns, and branch discipline.\n' +
        '---\n' +
        '\n',
    },
  },

  preserve: ['.gitkeep'],
} satisfies SyncConfig;
