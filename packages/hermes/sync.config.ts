// packages/hermes/sync.config.ts
// Sync config: derives Hermes SKILL.md files from canonical core directives.
// Hermes is a general-purpose agent, not a coding agent, so the canonical
// coding-focused prompts are adapted: tool references are generalized,
// role descriptions are broadened, and Hermes-native features are added.

import type { SyncConfig } from '../core/scripts/lib/config.js';

export default {
  source: '../core/agent-directives/specialists',
  output: 'src/maestria_hermes/skills',

  default: {
    // Strip canonical YAML frontmatter (OpenCode-specific permission blocks)
    stripFrontmatter: true,

    replace: [
      // Specialist mentions: @name -> name (Hermes uses bare names in skill context)
      { from: '@adventurer', to: 'adventurer' },
      { from: '@architect', to: 'architect' },
      { from: '@builder', to: 'builder' },
      { from: '@diagnose', to: 'diagnose' },
      { from: '@planner', to: 'planner' },
      { from: '@reviewer', to: 'reviewer' },
      { from: '@writer', to: 'writer' },
      { from: '@orchestrator', to: 'orchestrator' },

      // Dispatch mechanism: task() -> delegate_task() (Hermes native subagent tool)
      { from: 'task(', to: 'delegate_task(' },

      // Domain generalization: broaden coding-specific language for general-purpose agent
      { from: 'Codebase exploration', to: 'Research and exploration' },
      { from: 'code review', to: 'quality review and validation' },
      { from: 'review PR', to: 'review work' },
      { from: 'code for quality', to: 'output for quality' },
      { from: 'code changes', to: 'changes' },
      { from: 'code review guidelines', to: 'review guidelines' },
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
      { from: 'You review code for quality.', to: 'You review output for quality.' },
      { from: 'You write documentation.', to: 'You create clear, structured content.' },

      // Tool references: adapt to Hermes tool names
      { from: '`opensrc`', to: '`webfetch`/`browser`' },
      { from: 'opensrc', to: 'webfetch' },
      { from: '`lsp`', to: '`grep`/`codegraph`' },
      { from: 'lsp', to: 'grep' },
      { from: '`websearch`', to: '`web_search`' },
      { from: 'websearch', to: 'web_search' },

      // Git-specific: generalize since git operations happen via OpenCode or direct tools
      { from: 'git diff', to: 'diff' },
      { from: 'git status', to: 'status' },
      { from: 'git log', to: 'log' },
      { from: 'git add', to: 'stage' },

      // Coding-specific references in rules and processes
      {
        from: 'Run tests or type checks to confirm correctness',
        to: 'Verify correctness through available validation methods',
      },
      { from: 'tests, type check, lint', to: 'verification results' },
      { from: 'TypeScript errors', to: 'issues or errors' },
      { from: 'tsconfig.json or build output', to: 'configuration or build output' },
      { from: 'Related Agents', to: 'Related Specialists' },
    ],
  },

  files: {
    // -- Command workflow modes (fein/sonar/blitz) --
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
    'commands/blitz.md': {
      frontmatter: {
        description:
          'Fast implementation mode: skip optional ceremony for familiar low-risk work; required review and safety floors remain',
        name: 'maestria-command-blitz',
      },
      output: 'commands/blitz/SKILL.md',
      stripFrontmatter: true,
    },

    // -- Orchestrator: the methodology dispatcher --
    'orchestrator.md': {
      append: [
        '',
        '## Hermes-Specific Notes',
        '',
        '- **Default: single-thread execution.** Hermes orchestrator has full tool access. Delegate to specialists only for complex tasks (4+ files, multi-domain, risky changes, or explicit "Maestria mode").',
        '- `delegate_task` is for multi-step tasks that benefit from parallelization or specialist expertise.',
        '- Each specialist has a `PermissionRole` restricting its tools.',
        '- Mode context (fein/sonar/blitz) is injected via pre_llm_call hook automatically.',
        '- Sonar mode blocks write tools via pre_tool_call hook.',
        '- Set `[MAESTRIA_ROLE: <role>]` in delegate_task context for permission enforcement.',
        '- Dispatch reviewer for validation after the integrated builder batch is reconciled, never per individual builder delegation - general review first, then risk-matched lenses sequentially (not after direct single-thread work).',
      ].join('\n'),
      frontmatter: {
        description:
          'Methodology orchestrator -- runs single-thread by default, delegates to specialists for complex tasks',
        name: 'maestria-orchestrator',
      },
      output: 'orchestrator/SKILL.md',
      prepend: '',
      replace: [],
    },
    'adventurer.md': {
      frontmatter: {
        description: 'Research and exploration -- gathers information from any source',
        name: 'maestria-adventurer',
      },
      output: 'adventurer/SKILL.md',
      replace: [],
    },

    // -- Architect: design and decision --
    'architect.md': {
      frontmatter: {
        description:
          'Architecture and design -- evaluates options, makes decisions, designs solutions across any domain',
        name: 'maestria-architect',
      },
      output: 'architect/SKILL.md',
      replace: [
        {
          from: 'You make architecture decisions systematically.',
          to: 'You make design and architecture decisions systematically, across any domain.',
        },
      ],
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
        'The PermissionRole for builder grants full access (read + write + bash + llm + coding).',
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
          // Re-anchored 2026-08: the canonical Step 1.5 sentence was reworded
          // upstream and the old lockfile-specific anchor silently no-op'd.
          from: "Check relevant dependency manifests and lockfiles for recent changes using the project's diff/version-control tools",
          to: 'Check for recent changes in configuration or dependencies',
        },
        {
          from: 'Rule out environmental causes by gathering data directly',
          to: 'Rule out environmental causes before deeper investigation',
        },
      ],
    },

    // -- Planner: planning and execution --
    'planner.md': {
      output: 'planner/SKILL.md',
      frontmatter: {
        description: 'Planning -- breaks down work into ordered, verifiable steps',
        name: 'maestria-planner',
      },
      // NOTE: no replace ops. The previous five generalization replaces
      // anchored to the canonical Guard Rails bullet lists, which were
      // consolidated into a single guard-rails line; that line is already
      // general-purpose wording.
    },

    // -- Reviewer: quality validation --
    'reviewer.md': {
      frontmatter: {
        description: 'Quality gates -- validates output, checks for issues, ensures correctness',
        name: 'maestria-reviewer',
      },
      output: 'reviewer/SKILL.md',
      replace: [
        { from: 'review code', to: 'review output' },
        { from: "Google's Code Review Guidelines", to: 'Peer review best practices' },
        { from: 'The Standard of Code Review', to: 'Standard review practices' },
        { from: 'What to Look For in a Code Review', to: 'What to look for in a review' },
      ],
    },

    // -- Writer: content creation --
    'writer.md': {
      frontmatter: {
        description: 'Content creation -- produces clear, structured documentation and prose',
        name: 'maestria-writer',
      },
      output: 'writer/SKILL.md',
      replace: [],
    },

    // -- Rules: cross-cutting methodology rules --
    // rules.md lives at packages/core/agent-directives/rules.md (parent of specialists/)
    // The secondary source mechanism in sync.ts resolves it automatically.
    'rules.md': {
      output: 'global-rules/SKILL.md',
      stripFrontmatter: true,
      frontmatter: {
        description: 'Cross-cutting methodology rules for all specialists',
        name: 'maestria-global-rules',
      },
      // NOTE: no replace ops. The previous four generalization replaces
      // anchored to canonical sentences/tables removed by earlier directive
      // revisions and silently no-op'd; the revised canonical rules body is
      // already general-purpose wording.
    },
  },

  // Preserve files in the output directory that aren't generated by sync
  preserve: ['.gitkeep'],
} satisfies SyncConfig;
