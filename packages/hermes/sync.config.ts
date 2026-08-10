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
        description:
          'Fast implementation mode: skip optional ceremony for familiar low-risk work; preserve safety and review floors',
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
        // Delegated children on Hermes are read/research/LLM-only; the
        // canonical "editing and shell commands belong to specialists"
        // claim must not read as a capability grant for delegated children.
        {
          from: 'Research and exploration, editing, and shell commands belong to specialists. Direct turns may run on the host only for explanation, discovery, or platform-supported non-code work; code changes route to a permitted `builder`.',
          to: 'Delegated specialists work under the fixed role-neutral child policy (read/research/LLM-only): they cannot write, run a shell, or execute code. Direct turns may run on the host only for explanation, discovery, or platform-supported non-code work; code changes on Hermes are performed by a trusted top-level fein session under its direct-access boundary, not by a delegated child.',
        },
      ],
      append: [
        '',
        '## Hermes-Specific Notes',
        '',
        '- **Delegated children are read/research/LLM-only.** Native Hermes child roles (`leaf`/`orchestrator`) are topology signals only, not Maestria specialist identities; they never grant write, shell, code-execution, delegation, or OpenCode access. Code changes on Hermes are performed by a trusted top-level fein session under its direct-access boundary, not by a delegated `builder` child.',
        '- `delegate_task` is available for complex non-code tasks that benefit from specialist expertise; a delegated child works under the fixed role-neutral read/research/LLM-only policy.',
        '- Trust and tool capability come only from trusted native lifecycle state; never encode roles or capabilities in user-controlled task text.',
        '- Mode context (fein/sonar/blitz) is injected via pre_llm_call hook automatically.',
        '- Sonar mode blocks write tools via pre_tool_call hook.',
        '- Hermes has no native review-state or landing gate. Review enforcement is advisory here; pre_tool_call still enforces the lifecycle trust boundaries, the direct-Blitz tool allowlist, and the child-safe tool policy.',
        '- Dispatch reviewer for validation after non-trivial builder work, including builder work started from blitz.',
      ].join('\n'),
    },
    'adventurer.md': {
      output: 'adventurer/SKILL.md',
      frontmatter: {
        name: 'maestria-adventurer',
        description: 'Research and exploration -- gathers information from any source',
      },
      replace: [],
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
          from: 'A single configuration change',
          to: 'A single configuration change or content update',
        },
      ],
      append: [
        '',
        '## Hermes Delegation Boundary',
        '',
        'A delegated `builder` child on Hermes runs under the fixed role-neutral child policy: read/research/LLM-only. It cannot write, edit, run a shell, execute code, delegate further, or invoke `opencode_route`. Hermes native child roles (`leaf`/`orchestrator`) are topology signals only and provide no authenticated capability channel that binds a delegated child to specialist write access.',
        '',
        'Code changes on Hermes are performed by a trusted top-level fein session under its direct-access boundary. Role-specific delegated builder writes are deferred until Hermes exposes an authenticated capability channel.',
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
        {
          from: 'Check `pnpm-lock.yaml` / `package-lock.json` for recent changes (`git diff`)',
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
        name: 'maestria-planner',
        description: 'Planning -- breaks down work into ordered, verifiable steps',
      },
      replace: [
        {
          from: '- Write tests for new functionality',
          to: '- Verify each output meets its success criteria',
        },
        {
          from: '- Run type checking after changes',
          to: '- Run validation checks after each change',
        },
        {
          from: '- Commit with conventional commits',
          to: '- Document changes following project conventions',
        },
        {
          from: "- Don't change architecture unless explicitly asked",
          to: "- Don't change scope unless explicitly asked",
        },
        {
          from: "- Don't add new dependencies without approval",
          to: "- Don't introduce new tools or approaches without justification",
        },
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
      ],
    },

    // -- Writer: content creation --
    'writer.md': {
      output: 'writer/SKILL.md',
      frontmatter: {
        name: 'maestria-writer',
        description: 'Content creation -- produces clear, structured documentation and prose',
      },
      replace: [],
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
          from: '**!!! Maker/checker split** - your work is reviewed by `@reviewer` before it lands.',
          to: '**!!! Maker/checker split** - your work is reviewed before it lands. The reviewer has no write access.',
        },
        {
          from: 'validation commands `check`/`test`',
          to: 'validation commands',
        },

        // Generalize delegation rules for Hermes
        // [inferred] Re-based onto the PR #157 route-scoped canonical sentence.
        // The old canonical phrase ("Never delegate to platform-native built-in
        // agents - they are built-in, not part of the pipeline.") was removed by
        // PR #157, so the old `from` silently no-oped and raw canonical text shipped.
        // `explore`/`general` are Hermes' built-in agents - the adaptation intent is
        // preserved from the pre-PR config.
        {
          from: 'Focused and full routes delegate only to the 7 specialists below - do not substitute platform-native built-in agents for them.',
          to: 'Focused and full routes delegate only to the 7 specialists below - never delegate to built-in `explore` or `general` - they bypass the pipeline.',
        },
        {
          from: '| `@adventurer` | Codebase reconnaissance, deep code understanding | Understanding unfamiliar code, tracing dependencies, gathering context before implementation |',
          to: '| `adventurer` | Research and exploration, deep understanding | Understanding unfamiliar code, tracing dependencies, gathering context |',
        },
      ],
    },
  },

  // Preserve files in the output directory that aren't generated by sync
  preserve: ['.gitkeep'],
} satisfies SyncConfig;
