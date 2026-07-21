// packages/cursor/sync.config.ts
// Sync config: derives Cursor plugin agents/skills/rules from canonical core directives

import type { SyncConfig } from '../core/scripts/lib/config.js';

const CURSOR_TOOL_REPLACES = [
  { from: '@adventurer', to: 'adventurer' },
  { from: '@architect', to: 'architect' },
  { from: '@builder', to: 'builder' },
  { from: '@diagnose', to: 'diagnose' },
  { from: '@planner', to: 'planner' },
  { from: '@reviewer', to: 'reviewer' },
  { from: '@writer', to: 'writer' },
  { from: '@orchestrator', to: 'orchestrator' },
  { from: 'task(', to: 'Task(' },
  { from: 'question()', to: 'ask the user' },
  { from: 'question(', to: 'ask the user(' },
  { from: 'webfetch', to: 'WebFetch' },
  { from: 'websearch', to: 'WebSearch' },
  { from: '`webfetch`', to: '`WebFetch`' },
  { from: '`read`', to: '`Read`' },
  { from: '`glob`', to: '`Glob`' },
  { from: '`grep`', to: '`Grep`' },
  { from: '`edit`', to: '`StrReplace`' },
  { from: '`write`', to: '`Write`' },
  { from: '`bash`', to: '`Shell`' },
  { from: 'grep(', to: 'Grep(' },
  { from: 'glob(', to: 'Glob(' },
  { from: '`lsp`', to: 'a language server protocol' },
  { from: 'Related Agents', to: 'Related Agents' },
  { from: 'run in parallel', to: 'run in parallel via multiple `Task` calls' },
] as const;

const ORCHESTRATOR_APPEND = `

## Specialist Agents (Cursor)

Delegate via the \`Task\` tool to these custom agents (plugin \`agents/\`). Pass a complete handoff contract in the prompt.

| Agent | Role | When |
| --- | --- | --- |
| \`adventurer\` | Gather data; describe the terrain | Before any implementation in unfamiliar code |
| \`architect\` | Evaluate options; document decisions | When multiple approaches exist |
| \`builder\` | Implement; test; refactor | When the design is locked |
| \`diagnose\` | Find root cause; write regression test | When something is broken |
| \`planner\` | Break down work; sequence milestones | Before starting a multi-step feature |
| \`reviewer\` | Review; QA; check correctness | After builder lands a change |
| \`writer\` | Document APIs; write README; create ADRs | When code needs human-facing docs |

### How to invoke

1. Load this orchestrator skill for methodology (already in context when relevant).
2. Call \`Task\` with the specialist agent name and a full handoff: Goal, Context, Requirements, Known problems, Assumptions, Success criteria, Next step.
3. For parallel independent work, launch multiple \`Task\` calls in one turn.

### Maker/checker (two-layer enforcement)

Cursor agents use a two-layer maker/checker split:

1. **Runtime enforcement** — \`readonly: true\` flag on \`adventurer\`, \`planner\`, and \`reviewer\` agents blocks write tools (Write, StrReplace, Delete) at the Cursor runtime level.
2. **Prompt-level guidance** — Agent prompts also include explicit read-only instructions as a backup.

Enforce the split: never send review work to the same agent that implemented; \`reviewer\` / \`adventurer\` / \`planner\` must not edit files.

## Workflow Commands

Users can trigger modes with slash commands from this plugin:

| Command | Pipeline |
| --- | --- |
| \`/fein\` | Full pipeline: adventurer → architect/planner → builder → reviewer |
| \`/sonar\` | Research only: adventurer → architect/planner → STOP |
| \`/blitz\` | Fast path: builder directly (skip recon/design unless unknown) |

## Related Agents

- \`adventurer\` - Codebase reconnaissance
- \`architect\` - Architecture decisions + ADRs
- \`builder\` - Focused implementation
- \`diagnose\` - 6-step bug tracing
- \`planner\` - Multi-phase plans
- \`reviewer\` - Code review with quality gates
- \`writer\` - Documentation
`;

export default {
  source: '../core/agent-directives/specialists',
  output: 'agents',

  default: {
    replace: [...CURSOR_TOOL_REPLACES],
  },

  files: {
    'adventurer.md': {
      output: 'adventurer.md',
      prepend:
        '**Read-only.** You have Read, Glob, Grep, Shell, WebSearch, and WebFetch. Do **not** use Write, StrReplace, or Delete. Exploration only — never implement or design.\n\n',
      frontmatter: {
        name: 'adventurer',
        description:
          'Codebase reconnaissance agent. Maps unknown territory, traces call chains, maps module relationships. Use before implementation in unfamiliar code. Read-only — never implement or design.',
        readonly: true,
      },
    },
    'architect.md': {
      output: 'architect.md',
      frontmatter: {
        name: 'architect',
        description:
          'Architecture decisions using decision matrices and ADRs. Evaluates options with weighted criteria. Use for technology choices, implementation approaches, trade-off analysis.',
      },
    },
    'builder.md': {
      output: 'builder.md',
      frontmatter: {
        name: 'builder',
        description:
          'Focused implementation agent for atomic tasks. Executes one verifiable unit of work. Use for targeted fixes, feature implementation, refactors, adding tests.',
      },
    },
    'diagnose.md': {
      output: 'diagnose.md',
      frontmatter: {
        name: 'diagnose',
        description:
          'Systematic 6-step regression tracing from error message to root cause to prevention. Use for cryptic errors, regressions, production bugs.',
      },
    },
    'planner.md': {
      output: 'planner.md',
      prepend:
        '**Plan only.** Prefer Read, Glob, Grep, Shell (read-only), WebSearch, WebFetch. Do **not** implement or edit production code — produce a structured plan.\n\n',
      frontmatter: {
        name: 'planner',
        description:
          'Create detailed implementation plans with phased dependencies, timelines, and success criteria. Use for complex multi-phase features before building.',
        readonly: true,
      },
    },
    'reviewer.md': {
      output: 'reviewer.md',
      prepend:
        '**Checker only — maker/checker split.** Produce a structured review report. Do **not** use Write, StrReplace, or Delete. Do not fix issues yourself; report them for builder.\n\n',
      frontmatter: {
        name: 'reviewer',
        description:
          'Code review with quality gates. Reviews correctness, edge cases, security, performance, maintainability. Use after builder lands a change. Read-only — never edit.',
        readonly: true,
      },
    },
    'writer.md': {
      output: 'writer.md',
      frontmatter: {
        name: 'writer',
        description:
          'Documentation writing following structured patterns. Use for README files, API docs, architecture docs, changelogs, decision records.',
      },
    },
    'orchestrator.md': {
      output: '../skills/orchestrator/SKILL.md',
      frontmatter: {
        name: 'orchestrator',
        description:
          'Maestria dispatcher for Cursor. Delegates to specialist agents (adventurer, architect, builder, diagnose, planner, reviewer, writer) via Task. Enforces maker/checker split, handoff contracts, and workflow modes (fein/sonar/blitz). Use for multi-step or multi-file work.',
      },
      append: ORCHESTRATOR_APPEND,
    },
    'rules.md': {
      output: '../rules/maestria-global.mdc',
      frontmatter: {
        description:
          'Maestria global agent rules — always apply for Cursor sessions using the maestria plugin',
        alwaysApply: true,
      },
      replace: [
        { from: '# Global Agent Rules', to: '# Global Agent Rules - @maestria/cursor' },
        { from: '`bash --help`', to: '`Shell` help / skill docs' },
        {
          from: 'When delegating work via `Task()`, use only the 7 specialists below. **Never delegate to `explore` or `general`** - they are built-in agents, not part of the pipeline.',
          to: 'When delegating work via the `Task` tool, use only the 7 specialist agents below (plugin `agents/`). Do not use built-in general-purpose agents for pipeline work.',
        },
      ],
    },
    'commands/fein.md': {
      output: '../commands/fein.md',
      stripFrontmatter: true,
      replace: [
        { from: '@adventurer', to: 'adventurer' },
        { from: '@architect', to: 'architect' },
        { from: '@builder', to: 'builder' },
        { from: '@reviewer', to: 'reviewer' },
        { from: '@planner', to: 'planner' },
      ],
      prepend: [
        '---',
        'name: fein',
        'description: Run the full Maestria pipeline (recon -> design -> implement -> review)',
        '---',
        '',
      ].join('\n'),
      append: [
        '',
        'Load the `orchestrator` skill for delegation methodology. Use the `Task` tool to spawn each specialist agent with a complete handoff contract.',
        '',
        'If the user provided a goal after `/fein`, run the pipeline on that goal now.',
      ].join('\n'),
    },
    'commands/sonar.md': {
      output: '../commands/sonar.md',
      stripFrontmatter: true,
      replace: [
        { from: '@adventurer', to: 'adventurer' },
        { from: '@architect', to: 'architect' },
        { from: '@planner', to: 'planner' },
      ],
      prepend: [
        '---',
        'name: sonar',
        'description: Research-only Maestria mode (recon -> design, no implementation)',
        '---',
        '',
      ].join('\n'),
      append: [
        '',
        'Load the `orchestrator` skill for delegation methodology. Use the `Task` tool to spawn specialists with a complete handoff contract.',
        '',
        'If the user provided a goal after `/sonar`, research that goal now.',
      ].join('\n'),
    },
    'commands/blitz.md': {
      output: '../commands/blitz.md',
      stripFrontmatter: true,
      replace: [
        { from: '@builder', to: 'builder' },
        { from: '@reviewer', to: 'reviewer' },
        { from: '@adventurer', to: 'adventurer' },
      ],
      prepend: [
        '---',
        'name: blitz',
        'description: Fast Maestria implementation via builder (skip recon/design unless unknown)',
        '---',
        '',
      ].join('\n'),
      append: [
        '',
        'Load the `orchestrator` skill if coordination is needed. Prefer a single `Task` to `builder` with a clear handoff.',
        '',
        'If the user provided a goal after `/blitz`, implement that goal now.',
      ].join('\n'),
    },
  },

  preserve: ['.gitkeep'],
} satisfies SyncConfig;
