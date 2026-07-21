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
      {
        from: 'codebase reconnaissance agent for deep code understanding',
        to: 'research and exploration specialist for deep understanding across any domain',
      },
      { from: 'Codebase exploration', to: 'Research and exploration' },
      { from: 'code review', to: 'quality review and validation' },
      { from: 'review this PR', to: 'review this output' },
      { from: 'review PR', to: 'review work' },
      { from: 'code for quality', to: 'output for quality' },
      { from: 'code changes', to: 'changes' },
      { from: 'code review guidelines', to: 'review guidelines' },
      { from: 'code, not the person', to: 'work, not the person' },

      // Generalize role identities
      {
        from: 'You are a codebase reconnaissance agent.',
        to: 'You are a research and exploration specialist.',
      },
      {
        from: 'You are an architecture decision-making agent.',
        to: 'You are a design and decision specialist.',
      },
      {
        from: 'You are a focused implementation agent for atomic tasks.',
        to: 'You are a production specialist for atomic tasks.',
      },
      {
        from: 'You are a systematic debugging agent.',
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
        from: 'run tests or type checks to confirm correctness',
        to: 'verify correctness through available validation methods',
      },
      { from: 'tests, type check, lint', to: 'verification results' },
      { from: 'Test or type check to confirm', to: 'Verify' },
      { from: 'TypeScript errors', to: 'issues or errors' },
      { from: 'tsconfig.json or build output', to: 'configuration or build output' },
      { from: 'Related Agents', to: 'Related Specialists' },
    ],
  },

  files: {
    // -- Command workflow modes (fein/sonar/blitz) --
    'commands/fein.md': {
      output: 'commands/fein/SKILL.md',
      stripFrontmatter: true,
      frontmatter: {
        name: 'maestria-command-fein',
        description: 'Full pipeline mode: reconnaissance, design, implementation, review',
      },
    },
    'commands/sonar.md': {
      output: 'commands/sonar/SKILL.md',
      stripFrontmatter: true,
      frontmatter: {
        name: 'maestria-command-sonar',
        description: 'Research-only mode: reconnaissance and design only, no implementation',
      },
    },
    'commands/blitz.md': {
      output: 'commands/blitz/SKILL.md',
      stripFrontmatter: true,
      frontmatter: {
        name: 'maestria-command-blitz',
        description: 'Fast implementation mode: skip gates, go directly to implementation',
      },
    },

    // -- Orchestrator: the methodology dispatcher --
    'orchestrator.md': {
      output: 'orchestrator/SKILL.md',
      frontmatter: {
        name: 'maestria-orchestrator',
        description:
          'Methodology orchestrator -- runs single-thread by default, delegates to specialists for complex tasks',
      },
      prepend: '',
      replace: [
        // Override the "pure dispatcher" mandate for Hermes (full-tool agent)
        {
          from: 'You are a dispatcher. Your only tools for making progress on a task are `delegate_task()` (delegate to a specialist) and `question()` (ask the user).',
          to: 'You are a methodology orchestrator. On Hermes you have full tool access and default to single-thread execution. Delegate via `delegate_task()` only for complex tasks (4+ files, multi-domain, risky changes, or explicit "Maestria mode") that benefit from parallelization or specialist focus.',
        },
        {
          from: 'If you are tempted to "just check" something in the codebase - that is a `delegate_task()` call, not something you can do yourself. Delegation is the path of least resistance, by design.',
          to: 'If you are tempted to delegate a simple task - do it directly. `delegate_task()` is for complexity, not convenience.',
        },
        {
          from: '1. **!!! Never implement yourself** - See the top of this prompt for the dispatcher mandate. You can only make progress via `delegate_task()` delegation.',
          to: '1. **Default to direct implementation.** Only delegate for complex tasks.',
        },
        {
          from: "5. **!!! Pure router** - Your reasoning output is context for delegations, not the product. Keep analysis to what's needed for a good delegation decision. Do not produce artifacts (designs, code, documentation) yourself - delegate production to specialists.",
          to: '5. **Produce or delegate based on complexity** - For simple tasks, produce artifacts directly. For complex tasks, produce delegation briefings for specialists. Your reasoning serves the task either way.',
        },
        {
          from: '11. **!!! Don\'t anthropomorphize effort** - You are a dispatcher, not an implementer. Thinking "that analysis would be too much work" or "this approach is less effort" is always wrong reasoning - you delegate all work to specialists who have machine-scale capabilities. When assessing alternatives, choose the right specialist for the question, not the one that "feels" like less work. Effort estimation using human standards is a category error for a dispatcher that only routes.',
          to: '11. **!!! Don\'t anthropomorphize effort** - You are an orchestrator, not a manual worker. Thinking "that analysis would be too much work" or "this approach is less effort" is always wrong reasoning - you delegate all work to specialists who have machine-scale capabilities. When assessing alternatives, choose the right specialist for the question, not the one that "feels" like less work. Effort estimation using human standards is a category error for an orchestrator that delegates appropriately.',
        },
      ],
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
        '- Dispatch reviewer for validation after builder delegation (not after direct single-thread work).',
      ].join('\n'),
    },
    'adventurer.md': {
      output: 'adventurer/SKILL.md',
      frontmatter: {
        name: 'maestria-adventurer',
        description: 'Research and exploration -- gathers information from any source',
      },
      replace: [
        // The canonical adventurer references code-specific tools; Hermes has a broader toolset
        {
          from: 'Trace code paths, find key files, map relationships',
          to: 'Trace paths, find key sources, map relationships across any domain',
        },
        {
          from: 'Scan first, plan second, implement third',
          to: 'Research first, analyze second, act third',
        },
      ],
    },

    // -- Architect: design and decision --
    'architect.md': {
      output: 'architect/SKILL.md',
      frontmatter: {
        name: 'maestria-architect',
        description:
          'Architecture and design -- evaluates options, makes decisions, designs solutions across any domain',
      },
      replace: [
        {
          from: 'You make architecture decisions systematically.',
          to: 'You make design and architecture decisions systematically, across any domain.',
        },
      ],
    },

    // -- Builder: production and implementation --
    'builder.md': {
      output: 'builder/SKILL.md',
      frontmatter: {
        name: 'maestria-builder',
        description: 'Focused production -- implements, creates, and produces output',
      },
      replace: [
        {
          from: 'single configuration change',
          to: 'single configuration change or content update',
        },
      ],
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
    },

    // -- Diagnose: root cause analysis --
    'diagnose.md': {
      output: 'diagnose/SKILL.md',
      frontmatter: {
        name: 'maestria-diagnose',
        description: 'Root cause analysis -- investigates problems and finds causes',
      },
      replace: [
        {
          from: 'You trace bugs systematically.',
          to: 'You investigate problems and trace root causes systematically.',
        },
        { from: 'Error -> Source Location', to: 'Problem -> Source Location' },
        { from: 'Look for recent file changes in git', to: 'Look for recent changes' },
        {
          from: 'Run type checker to isolate type errors',
          to: 'Run validation tools to isolate issues',
        },
      ],
    },

    // -- Planner: planning and execution --
    'planner.md': {
      output: 'planner/SKILL.md',
      frontmatter: {
        name: 'maestria-planner',
        description: 'Planning -- breaks down work into ordered, verifiable steps',
      },
      replace: [
        {
          from: 'Write tests for new functionality',
          to: 'Verify each output meets its success criteria',
        },
        { from: 'Run type checking after changes', to: 'Run validation checks after each change' },
        {
          from: 'Commit with conventional commits',
          to: 'Document changes following project conventions',
        },
        {
          from: "Don't change architecture unless explicitly asked",
          to: "Don't change scope unless explicitly asked",
        },
        {
          from: "Don't add new dependencies without approval",
          to: "Don't introduce new tools or approaches without justification",
        },
        {
          from: "Don't refactor existing code while adding features",
          to: "Don't restructure existing work while adding new work",
        },
        { from: "Don't skip verification steps", to: "Don't skip validation or review steps" },
      ],
    },

    // -- Reviewer: quality validation --
    'reviewer.md': {
      output: 'reviewer/SKILL.md',
      frontmatter: {
        name: 'maestria-reviewer',
        description: 'Quality gates -- validates output, checks for issues, ensures correctness',
      },
      replace: [
        { from: 'review code', to: 'review output' },
        { from: "Google's Code Review Guidelines", to: 'Peer review best practices' },
        { from: 'The Standard of Code Review', to: 'Standard review practices' },
        { from: 'What to Look For in a Code Review', to: 'What to look for in a review' },
        { from: 'Implement recommended fixes', to: 'Implement recommended changes' },
        { from: 'Investigate deeply', to: 'Investigate root causes' },
      ],
    },

    // -- Writer: content creation --
    'writer.md': {
      output: 'writer/SKILL.md',
      frontmatter: {
        name: 'maestria-writer',
        description: 'Content creation -- produces clear, structured documentation and prose',
      },
      replace: [
        {
          from: 'README, API Documentation, ADRs, Changelogs',
          to: 'README, API documentation, ADRs, changelogs, reports, articles',
        },
        { from: 'Verify examples', to: 'Verify examples and references' },
        { from: 'Capture ADRs', to: 'Document decisions as ADRs' },
      ],
    },

    // -- Rules: cross-cutting methodology rules --
    // rules.md lives at packages/core/agent-directives/rules.md (parent of specialists/)
    // The secondary source mechanism in sync.ts resolves it automatically.
    'rules.md': {
      output: 'global-rules/SKILL.md',
      stripFrontmatter: true,
      frontmatter: {
        name: 'maestria-global-rules',
        description: 'Cross-cutting methodology rules for all specialists',
      },
      replace: [
        // Generalize coding-specific rules for a general-purpose agent
        {
          from: 'Reviewer has `edit: deny`',
          to: 'Reviewer has no write access (maker/checker split)',
        },
        { from: 'Builder has `edit: allow`', to: 'Builder has full tool access' },
        { from: '`check`, `test`', to: 'validation checks' },
        { from: '`check`/`test`', to: 'validation commands' },

        // Remove platform-specific rules that don't apply
        {
          from: '!!! Git commands must go through @builder',
          to: '!!! Git operations go through builder or OpenCode when coding',
        },
        {
          from: 'Delegate validation (`check`, `test`) to @builder before the commit lands',
          to: 'Delegate validation to the appropriate specialist before completing',
        },

        // Generalize delegation rules for Hermes
        {
          from: 'Never delegate to `explore` or `general`',
          to: 'Delegate only to the 7 specialists',
        },
        {
          from: '`@adventurer` for any codebase context',
          to: '`adventurer` for any research and exploration context',
        },
      ],
    },
  },

  // Preserve files in the output directory that aren't generated by sync
  preserve: ['.gitkeep'],
} satisfies SyncConfig;
