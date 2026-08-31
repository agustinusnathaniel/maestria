// packages/claude-code/sync.config.ts
// Sync config: derives Claude Code plugin agents, skills, and commands from
// canonical core directives. All methodology content is generated; only this
// config and the package metadata/docs/tests are hand-authored.

import type { SyncConfig } from '../core/scripts/lib/config.js';

// Plugin manifest name is `maestria` (see .claude-plugin/plugin.json), so
// every component is referenced by its namespaced identifier, e.g.
// `maestria:builder` for the builder agent and `maestria:global-rules` for
// the global-rules skill.
const AGENT_REF_REPLACES = [
  { from: '@adventurer', to: 'maestria:adventurer' },
  { from: '@architect', to: 'maestria:architect' },
  { from: '@builder', to: 'maestria:builder' },
  { from: '@diagnose', to: 'maestria:diagnose' },
  { from: '@planner', to: 'maestria:planner' },
  { from: '@reviewer', to: 'maestria:reviewer' },
  { from: '@writer', to: 'maestria:writer' },
] as const;

// Claude Code tool names are PascalCase; canonical content uses lowercase or
// backticked generic names.
const CLAUDE_TOOL_REPLACES = [
  { from: '`read`', to: '`Read`' },
  { from: '`glob`', to: '`Glob`' },
  { from: '`grep`', to: '`Grep`' },
] as const;

// Global rules skill preloaded into every specialist agent. The namespaced
// identifier matches the plugin manifest name (`maestria`).
const GLOBAL_RULES_PRELOAD = ['maestria:global-rules'];

// Prompt-level read-only notes for the three roles whose Write/Edit tools are
// denied at the runtime level via `disallowedTools` (user-authorized). The
// notes are advisory guidance; the runtime boundary is the frontmatter field.
const READ_ONLY_PREPENDS: Record<string, string> = {
  adventurer:
    '**Read-only role:** the Write and Edit tools are denied for this agent. You explore, trace, map, and report; you never implement, design, or edit.\n\n',
  planner:
    '**Read-only role:** the Write and Edit tools are denied for this agent. Produce a structured plan with phases, verification, and rollback points; do not edit files.\n\n',
  reviewer:
    '**Read-only role:** the Write and Edit tools are denied for this agent. Produce a review report with verdicts; do not fix issues yourself - report them for the builder.\n\n',
};

const ORCHESTRATOR_APPEND = `

## Claude Code Integration

### Global rules

The universal contracts live in the \`maestria:global-rules\` skill, which every specialist agent preloads. Load it once per session via the Skill tool when you need the full contract text.

### Specialist agents

Delegate with the Agent tool using these scoped agent names:

| Agent | Role | Delegate when you see |
| --- | --- | --- |
| \`maestria:adventurer\` | Codebase reconnaissance | unfamiliar code, tracing, mapping, or locating behavior |
| \`maestria:architect\` | Architecture decisions | trade-offs, technology, boundaries, threat model, or ADR decisions |
| \`maestria:builder\` | Atomic implementation | a concrete feature, bug fix, test, or refactor with no identified uncertainty |
| \`maestria:diagnose\` | Root-cause analysis | a bug, regression, failure, crash, or unclear cause |
| \`maestria:planner\` | Phased planning | a multi-phase feature, rollout, or migration plan |
| \`maestria:reviewer\` | Independent quality review | post-implementation validation or explicit review |
| \`maestria:writer\` | Documentation | README, changelog, API docs, or structured prose |

\`maestria:adventurer\`, \`maestria:planner\`, and \`maestria:reviewer\` deny the \`Write\` and \`Edit\` tools at the runtime level (read-only research and review roles).

### Workflow commands

| Command | Pipeline |
| --- | --- |
| \`/maestria:fein\` | Full pipeline: recon -> design -> implement -> review |
| \`/maestria:sonar\` | Research only: owning specialist -> optional distinct specialist -> STOP |
| \`/maestria:blitz\` | Fast path: direct or \`maestria:builder\` (skip optional ceremony; required review remains) |

### Platform notes

- Methodology and skills are advisory guidance, not hard security enforcement. Tool restrictions (\`disallowedTools\`) are enforced by Claude Code; everything else is prompt guidance.
- Plugin agent frontmatter \`permissionMode\`, \`hooks\`, and \`mcpServers\` are ignored by Claude Code; do not rely on them.
`;

const COMMAND_APPENDS: Record<string, string> = {
  blitz: `
Fast implementation mode. Load the \`maestria:orchestrator\` skill if coordination is needed. If the user provided a goal after \`/maestria:blitz\`, implement that goal now.
`,
  fein: `
Run the complete maestria pipeline. Load the \`maestria:orchestrator\` skill for routing and delegation methodology. If the user provided a goal after \`/maestria:fein\`, run the pipeline on that goal now.
`,
  sonar: `
Research-only mode. Load the \`maestria:orchestrator\` skill for routing and delegation methodology. If the user provided a goal after \`/maestria:sonar\`, research that goal now and stop; do not implement.
`,
};

export default {
  default: {
    replace: [...AGENT_REF_REPLACES, ...CLAUDE_TOOL_REPLACES],
  },
  files: {
    'adventurer.md': {
      frontmatter: {
        description: `Codebase reconnaissance agent for deep code understanding.
Maps unknown territory - traces call chains, maps module relationships,
generates structured reports for downstream specialists.
Use for: understanding unfamiliar code, tracing dependencies, gathering
context before implementation, investigating module structures.
One role per session: exploration only - never implement or design.`,
        disallowedTools: 'Write, Edit',
        model: 'inherit',
        name: 'adventurer',
        skills: GLOBAL_RULES_PRELOAD,
      },
      prepend: READ_ONLY_PREPENDS.adventurer,
    },
    'architect.md': {
      frontmatter: {
        description: `Architecture decisions using decision matrices and ADRs.
Evaluates options with weighted criteria, clarifies business context first.
Use for: technology choices, implementation approaches, trade-off analysis.`,
        model: 'inherit',
        name: 'architect',
        skills: GLOBAL_RULES_PRELOAD,
      },
    },
    'builder.md': {
      frontmatter: {
        description: `Focused implementation agent for atomic tasks.
Executes one verifiable unit of work with minimal context.
Use for: targeted fixes, feature implementation, refactors, adding tests.`,
        model: 'inherit',
        name: 'builder',
        skills: GLOBAL_RULES_PRELOAD,
      },
    },
    'commands/blitz.md': {
      append: COMMAND_APPENDS.blitz,
      frontmatter: {
        description: 'Fast low-risk route - skip optional recon and design ceremony',
        name: 'blitz',
      },
      output: '../commands/blitz.md',
      stripFrontmatter: true,
    },
    'commands/fein.md': {
      append: COMMAND_APPENDS.fein,
      frontmatter: {
        description: 'Full pipeline - recon, design, implement, review',
        name: 'fein',
      },
      output: '../commands/fein.md',
      stripFrontmatter: true,
    },
    'commands/sonar.md': {
      append: COMMAND_APPENDS.sonar,
      frontmatter: {
        description:
          'Research only - owning specialist, optional distinct specialist, STOP before implementation',
        name: 'sonar',
      },
      output: '../commands/sonar.md',
      stripFrontmatter: true,
    },
    'diagnose.md': {
      frontmatter: {
        description: `Systematic 6-step regression tracing.
From error message to root cause to prevention.
Use for: cryptic errors, regressions, production bugs.`,
        model: 'inherit',
        name: 'diagnose',
        skills: GLOBAL_RULES_PRELOAD,
      },
    },
    'orchestrator.md': {
      append: ORCHESTRATOR_APPEND,
      frontmatter: {
        description: `Maestria methodology dispatcher for Claude Code.
Routes work (direct/focused/full), delegates to specialist agents
(maestria:adventurer, maestria:architect, maestria:builder, maestria:diagnose,
maestria:planner, maestria:reviewer, maestria:writer), and enforces the
maker/checker split, handoff contracts, and workflow modes (fein/sonar/blitz).
Use for multi-step or multi-file work, planning, review, debugging,
architecture decisions, or documentation.`,
        name: 'orchestrator',
      },
      output: '../skills/orchestrator/SKILL.md',
      replace: [
        {
          from: '`.maestria/workflow.md` and `.maestria/rules.md`',
          to: 'the `maestria:global-rules` skill',
        },
        {
          from: 'the universal rules contract',
          to: 'the `maestria:global-rules` skill',
        },
      ],
    },
    'planner.md': {
      frontmatter: {
        description: `Create detailed implementation plans with phased dependencies, timelines, and success criteria.
Breaks down complex features into verifiable milestones.
Use for: complex features requiring multi-phase execution, when the plan needs review before building.`,
        disallowedTools: 'Write, Edit',
        model: 'inherit',
        name: 'planner',
        skills: GLOBAL_RULES_PRELOAD,
      },
      prepend: READ_ONLY_PREPENDS.planner,
    },
    'reviewer.md': {
      frontmatter: {
        description: `Code review with quality gates.
Reviews code for correctness, edge cases, security, performance, maintainability,
and adherence to conventions. Provides specific, actionable feedback.
Use for: PR review, pre-commit review, architecture document review.`,
        disallowedTools: 'Write, Edit',
        model: 'inherit',
        name: 'reviewer',
        skills: GLOBAL_RULES_PRELOAD,
      },
      prepend: READ_ONLY_PREPENDS.reviewer,
    },
    'rules.md': {
      frontmatter: {
        description: `Universal agent rules contract: universal floors, orchestration, delegation,
context management, handoff, blind review, bounded autonomy, authorization
checkpoints, process lifecycle, iteration, and commit and branch safety.
Load once per session and apply to routing, delegation, review, and commit
decisions.`,
        name: 'global-rules',
        'user-invocable': false,
      },
      output: '../skills/global-rules/SKILL.md',
      replace: [
        { from: '# Global Agent Rules', to: '# Global Agent Rules - @maestria/claude-code' },
      ],
    },
    'writer.md': {
      frontmatter: {
        description: `Documentation writing following structured patterns.
Creates clear, comprehensive docs for code, APIs, systems.
Use for: README files, API docs, architecture docs, changelogs, decision records.`,
        model: 'inherit',
        name: 'writer',
        skills: GLOBAL_RULES_PRELOAD,
      },
    },
  },
  output: 'agents',
  source: '../core/agent-directives/specialists',
} satisfies SyncConfig;
