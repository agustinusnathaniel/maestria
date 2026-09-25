// packages/cursor/sync.config.ts
// Sync config: derives Cursor plugin agents/skills/rules from canonical core directives

import { specialistReferenceReplacements } from '../core/scripts/lib/specialist-replacements.js';
import type { SyncConfig } from '../core/scripts/lib/config.js';

const CURSOR_TOOL_REPLACES = [
  ...specialistReferenceReplacements(),
  { from: 'run in parallel', to: 'run in parallel via multiple `Task` calls' },
] as const;

const ORCHESTRATOR_APPEND = `

## Specialist Agents (Cursor)

Delegate via the \`Task\` tool to the plugin's custom agents (\`agents/\`). Pass a complete handoff contract in the prompt.

### How to invoke

1. Load this orchestrator skill for methodology (already in context when relevant).
2. Call \`Task\` with the specialist agent name and a full handoff: Goal, Context, Requirements, Known problems, Assumptions, Success criteria, Next step.
3. For parallel independent work, launch multiple \`Task\` calls in one turn.

### Maker/checker (two-layer enforcement)

Cursor agents use a two-layer maker/checker split:

1. **Runtime enforcement** - \`readonly: true\` flag on \`adventurer\`, \`planner\`, and \`reviewer\` agents blocks write tools (Write, StrReplace, Delete) at the Cursor runtime level.
2. **Prompt-level guidance** - Agent prompts also include explicit read-only instructions as a backup.

Enforce the split: never send review work to the same agent that implemented; \`reviewer\` / \`adventurer\` / \`planner\` must not edit files.

## Workflow Commands

Users can trigger modes with slash commands from this plugin:

| Command | Pipeline |
| --- | --- |
| \`/fein\` | Full pipeline: adventurer → architect/planner → builder → reviewer |
| \`/sonar\` | Research only: adventurer → architect/planner → STOP |
| \`/blitz\` | Fast path: builder directly (skip optional recon/design unless unknown; required review remains) |
`;

export default {
  default: {
    replace: [...CURSOR_TOOL_REPLACES],
  },
  files: {
    'adventurer.md': {
      frontmatter: {
        description:
          'Codebase reconnaissance agent for mapping unfamiliar code, tracing call chains, and reporting verified context without implementing changes.',
        name: 'adventurer',
        readonly: true,
      },
      output: 'adventurer.md',
      prepend:
        '**Read-only.** You have Read, Glob, Grep, Shell, WebSearch, and WebFetch. Do **not** use Write, StrReplace, or Delete. Exploration only - never implement or design.\n\n',
    },
    'architect.md': {
      frontmatter: {
        description:
          'Architecture decision agent for comparing implementation approaches, boundaries, threat models, and ADR decisions.',
        name: 'architect',
      },
      output: 'architect.md',
    },
    'builder.md': {
      frontmatter: {
        description:
          'Focused implementation agent for one atomic, verifiable feature, fix, test, or refactor.',
        name: 'builder',
      },
      output: 'builder.md',
    },
    'commands/blitz.md': {
      append: [
        '',
        'Load the `orchestrator` skill if coordination is needed. Prefer a single `Task` to `builder` with a clear handoff.',
        '',
        'If the user provided a goal after `/blitz`, implement that goal now.',
      ].join('\n'),
      output: '../commands/blitz.md',
      prepend: [
        '---',
        'name: blitz',
        'description: Fast Maestria implementation via builder (skip optional recon/design unless unknown; required review remains)',
        '---',
        '',
      ].join('\n'),
      stripFrontmatter: true,
    },
    'commands/fein.md': {
      append: [
        '',
        'Load the `orchestrator` skill for delegation methodology. Use the `Task` tool to spawn each specialist agent with a complete handoff contract.',
        '',
        'If the user provided a goal after `/fein`, run the pipeline on that goal now.',
      ].join('\n'),
      output: '../commands/fein.md',
      prepend: [
        '---',
        'name: fein',
        'description: Run the full Maestria pipeline (recon -> design -> implement -> review)',
        '---',
        '',
      ].join('\n'),
      stripFrontmatter: true,
    },
    'commands/sonar.md': {
      append: [
        '',
        'Load the `orchestrator` skill for delegation methodology. Use the `Task` tool to spawn specialists with a complete handoff contract.',
        '',
        'If the user provided a goal after `/sonar`, research that goal now.',
      ].join('\n'),
      output: '../commands/sonar.md',
      prepend: [
        '---',
        'name: sonar',
        'description: Research-only Maestria mode (recon -> design, no implementation)',
        '---',
        '',
      ].join('\n'),
      stripFrontmatter: true,
    },
    'diagnose.md': {
      frontmatter: {
        description:
          'Systematic regression-tracing agent from symptom and error evidence to root cause, fix, and prevention.',
        name: 'diagnose',
      },
      output: 'diagnose.md',
    },
    'orchestrator.md': {
      append: ORCHESTRATOR_APPEND,
      frontmatter: {
        description:
          'Maestria workflow dispatcher for Cursor routing, handoffs, and independent review.',
        name: 'orchestrator',
      },
      output: '../skills/orchestrator/SKILL.md',
    },
    'planner.md': {
      frontmatter: {
        description:
          'Phased planning agent with dependencies, verification criteria, timelines, and rollback points.',
        name: 'planner',
        readonly: true,
      },
      output: 'planner.md',
      prepend:
        '**Plan only.** Prefer Read, Glob, Grep, Shell (read-only), WebSearch, WebFetch. Do **not** implement or edit production code - produce a structured plan.\n\n',
    },
    'reviewer.md': {
      frontmatter: {
        description:
          'Independent review agent covering correctness, security, performance, maintainability, and quality gates.',
        name: 'reviewer',
        readonly: true,
      },
      output: 'reviewer.md',
      prepend:
        '**Checker only - maker/checker split.** Produce a structured review report. Do **not** use Write, StrReplace, or Delete. Do not fix issues yourself; report them for builder.\n\n',
    },
    'rules.md': {
      frontmatter: {
        alwaysApply: true,
        description:
          'Maestria global agent rules - always apply for Cursor sessions using the maestria plugin',
      },
      output: '../rules/maestria-global.mdc',
      replace: [
        { from: '# Global Agent Rules', to: '# Global Agent Rules - @maestria/cursor' },
        // The revised canonical rules body no longer carries the specialist
        // roster; keep the delegation section self-contained for Cursor rules.
        {
          from: '## Delegation and Context\n',
          to: '## Delegation and Context\n\nDelegate only to the seven specialists: adventurer, architect, builder, diagnose, planner, reviewer, writer.\n',
        },
      ],
    },
    'writer.md': {
      frontmatter: {
        description:
          'Structured documentation agent for READMEs, API docs, architecture documents, changelogs, and decision records.',
        name: 'writer',
      },
      output: 'writer.md',
    },
  },
  output: 'agents',
  preserve: ['.gitkeep'],
  source: '../core/agent-directives/specialists',
} satisfies SyncConfig;
