// packages/hermes/sync.config.ts
// Sync config: derives Hermes SKILL.md files from canonical core directives.
// Hermes is a general-purpose agent, not a coding agent, so the canonical
// coding-focused prompts are adapted: tool references are generalized,
// role descriptions are broadened, and Hermes-native features are added.

import type { SyncConfig } from '../core/scripts/lib/config.js';

export default {
  default: {
    replace: [
      // Specialist mentions: @name -> name (Hermes uses bare names in skill context)
      { from: '@adventurer', to: 'adventurer' },
      { from: '@architect', to: 'architect' },
      { from: '@builder', to: 'builder' },
      { from: '@diagnose', to: 'diagnose' },
      { from: '@planner', to: 'planner' },
      { from: '@reviewer', to: 'reviewer' },
      { from: '@writer', to: 'writer' },

      // Domain generalization: broaden coding-specific language for general-purpose agent
      { from: 'code for quality', to: 'output for quality' },
      { from: 'Critique code, not developers', to: 'Critique work, not the person' },

      // Generalize role identities
      {
        from: 'You are a codebase reconnaissance agent.',
        to: 'You are a research and exploration specialist.',
      },
      {
        from: 'You make architecture decisions systematically.',
        to: 'You are a design and decision specialist.',
      },
      {
        from: 'You are a focused implementation agent.',
        to: 'You are a production specialist for atomic tasks.',
      },
      {
        from: 'You trace bugs systematically.',
        to: 'You are a root cause analysis specialist.',
      },
      { from: 'You create implementation plans.', to: 'You create plans for any multi-step work.' },
      { from: 'You write documentation.', to: 'You create clear, structured content.' },

      // Coding-specific references in rules and processes
      {
        from: 'Run tests or type checks to confirm correctness',
        to: 'Verify correctness through available validation methods',
      },
    ],
    // Strip canonical YAML frontmatter (OpenCode-specific permission blocks)
    stripFrontmatter: true,
  },

  files: {
    'adventurer.md': {
      frontmatter: {
        description: 'Research and exploration -- gathers information from any source',
        name: 'maestria-adventurer',
      },
      output: 'adventurer/SKILL.md',
    },

    // -- Architect: design and decision --
    'architect.md': {
      frontmatter: {
        description:
          'Architecture and design -- evaluates options, makes decisions, designs solutions across any domain',
        name: 'maestria-architect',
      },
      output: 'architect/SKILL.md',
    },

    // -- Builder: production and implementation --
    'builder.md': {
      append: [
        '',
        '## OpenCode Routing',
        '',
        "For complex multi-file coding tasks that benefit from OpenCode's dedicated sandbox, use the `opencode_route` tool. Simple tasks use Hermes built-in tools (edit, write, bash) directly.",
        '',
        '**Prerequisite:** Install OpenCode CLI: `npm i -g opencode-ai@latest`',
        '',
        'Tool access is fixed by the runtime: a trusted top-level fein session has full access, while delegated children are limited to read, research, and reasoning tools and cannot invoke `opencode_route`.',
      ].join('\n'),
      frontmatter: {
        description: 'Focused production -- implements, creates, and produces output',
        name: 'maestria-builder',
      },
      output: 'builder/SKILL.md',
      replace: [
        {
          from: 'A single configuration change',
          to: 'A single configuration change or content update',
        },
      ],
    },

    // -- Command workflow modes (fein/sonar/blitz) --
    'commands/blitz.md': {
      frontmatter: {
        description:
          'Fast implementation mode: skip optional ceremony for familiar low-risk work; required review and safety floors remain',
        name: 'maestria-command-blitz',
      },
      output: 'commands/blitz/SKILL.md',
      stripFrontmatter: true,
    },
    'commands/fein.md': {
      frontmatter: {
        description: 'Full pipeline mode: reconnaissance, design, implementation, review',
        name: 'maestria-command-fein',
      },
      output: 'commands/fein/SKILL.md',
      stripFrontmatter: true,
    },
    'commands/sonar.md': {
      frontmatter: {
        description: 'Research-only mode: reconnaissance and design only, no implementation',
        name: 'maestria-command-sonar',
      },
      output: 'commands/sonar/SKILL.md',
      stripFrontmatter: true,
    },

    // -- Diagnose: root cause analysis --
    'diagnose.md': {
      frontmatter: {
        description: 'Root cause analysis -- investigates problems and finds causes',
        name: 'maestria-diagnose',
      },
      output: 'diagnose/SKILL.md',
      replace: [
        { from: 'Error -> Source Location', to: 'Problem -> Source Location' },
        {
          from: "Check relevant dependency manifests and lockfiles for recent changes using the project's diff/version-control tools",
          to: 'Check for recent changes in configuration or dependencies',
        },
        {
          from: 'Rule out environmental causes by gathering data directly',
          to: 'Rule out environmental causes before deeper investigation',
        },
      ],
    },

    // -- Orchestrator: the methodology dispatcher --
    'orchestrator.md': {
      append: [
        '',
        '## Hermes-Specific Notes',
        '',
        '- **Default: single-thread execution.** Hermes orchestrator has full tool access. Delegate to specialists only for complex tasks (4+ files, multi-domain, risky changes, or explicit "Maestria mode").',
        '- `delegate_task` is for multi-step tasks that benefit from parallelization or specialist expertise.',
        '- Tool access is enforced by fixed allowlists rather than configurable roles: sonar and direct blitz sessions use literal tool lists, and delegated children get the same role-neutral read/research/reasoning policy in every mode.',
        '- Mode context (fein/sonar/blitz) is injected via pre_llm_call hook automatically.',
        '- Sonar mode blocks write tools via pre_tool_call hook.',
        '- Specialist names in `delegate_task` are routing labels, not permission grants; `[MAESTRIA_ROLE: <role>]` markers in task or user text are ignored.',
        '- Dispatch reviewer for validation after the integrated builder batch is reconciled, never per individual builder delegation - general review first, then risk-matched lenses sequentially (not after direct single-thread work).',
      ].join('\n'),
      frontmatter: {
        description:
          'Methodology orchestrator -- runs single-thread by default, delegates to specialists for complex tasks',
        name: 'maestria-orchestrator',
      },
      output: 'orchestrator/SKILL.md',
    },

    // -- Planner: planning and execution --
    'planner.md': {
      frontmatter: {
        description: 'Planning -- breaks down work into ordered, verifiable steps',
        name: 'maestria-planner',
      },
      output: 'planner/SKILL.md',
    },

    // -- Reviewer: quality validation --
    'reviewer.md': {
      frontmatter: {
        description: 'Quality gates -- validates output, checks for issues, ensures correctness',
        name: 'maestria-reviewer',
      },
      output: 'reviewer/SKILL.md',
      replace: [
        { from: "Google's Code Review Guidelines", to: 'Peer review best practices' },
        { from: 'The Standard of Code Review', to: 'Standard review practices' },
        { from: 'What to Look For in a Code Review', to: 'What to look for in a review' },
      ],
    },

    // -- Rules: cross-cutting methodology rules --
    // rules.md lives at packages/core/agent-directives/rules.md (parent of specialists/)
    // The secondary source mechanism in sync.ts resolves it automatically.
    'rules.md': {
      frontmatter: {
        description: 'Cross-cutting methodology rules for all specialists',
        name: 'maestria-global-rules',
      },
      output: 'global-rules/SKILL.md',
      stripFrontmatter: true,
    },

    // -- Writer: content creation --
    'writer.md': {
      frontmatter: {
        description: 'Content creation -- produces clear, structured documentation and prose',
        name: 'maestria-writer',
      },
      output: 'writer/SKILL.md',
    },
  },

  output: 'src/maestria_hermes/skills',
  // Preserve files in the output directory that aren't generated by sync
  preserve: ['.gitkeep'],
  source: '../core/agent-directives/specialists',
} satisfies SyncConfig;
