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

Delegate with the Agent tool using the scoped agent names in Specialist Ownership above.

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
    replace: [...AGENT_REF_REPLACES],
  },
  files: {
    'adventurer.md': {
      frontmatter: {
        description: `Codebase reconnaissance agent for mapping unfamiliar code, tracing call chains, and reporting verified context without implementing changes.`,
        disallowedTools: 'Write, Edit',
        model: 'inherit',
        name: 'adventurer',
        skills: GLOBAL_RULES_PRELOAD,
      },
      prepend: READ_ONLY_PREPENDS.adventurer,
    },
    'architect.md': {
      frontmatter: {
        description: `Architecture decision agent for comparing implementation approaches, boundaries, threat models, and ADR decisions.`,
        model: 'inherit',
        name: 'architect',
        skills: GLOBAL_RULES_PRELOAD,
      },
    },
    'builder.md': {
      frontmatter: {
        description: `Focused implementation agent for one atomic, verifiable feature, fix, test, or refactor.`,
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
        description: `Systematic regression-tracing agent from symptom and error evidence to root cause, fix, and prevention.`,
        model: 'inherit',
        name: 'diagnose',
        skills: GLOBAL_RULES_PRELOAD,
      },
    },
    'orchestrator.md': {
      append: ORCHESTRATOR_APPEND,
      frontmatter: {
        description: `Maestria workflow dispatcher for Claude Code routing, handoffs, and independent review.`,
        name: 'orchestrator',
      },
      output: '../skills/orchestrator/SKILL.md',
      replace: [
        {
          from: 'load the project-root `.maestria/workflow.md` and `.maestria/rules.md` in that order using the host tools',
          to: 'load the `maestria:global-rules` skill via the Skill tool, plus the project-root `.maestria/workflow.md` and `.maestria/rules.md` in that order using the host tools',
        },
      ],
    },
    'planner.md': {
      frontmatter: {
        description: `Phased planning agent with dependencies, verification criteria, timelines, and rollback points.`,
        disallowedTools: 'Write, Edit',
        model: 'inherit',
        name: 'planner',
        skills: GLOBAL_RULES_PRELOAD,
      },
      prepend: READ_ONLY_PREPENDS.planner,
    },
    'reviewer.md': {
      frontmatter: {
        description: `Independent review agent covering correctness, security, performance, maintainability, and quality gates.`,
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
        description: `Structured documentation agent for READMEs, API docs, architecture documents, changelogs, and decision records.`,
        model: 'inherit',
        name: 'writer',
        skills: GLOBAL_RULES_PRELOAD,
      },
    },
  },
  output: 'agents',
  source: '../core/agent-directives/specialists',
} satisfies SyncConfig;
