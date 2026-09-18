// packages/prime-agent/sync.config.ts
// Sync config: derives Prime Agent Agent Skills from canonical core directives.
// Prime Agent implements the Agent Skills standard (SKILL.md + frontmatter with
// required `name` and `description`); every skill is emitted as
// skills/<name>/SKILL.md so it is discoverable in every documented Prime skill
// location (project/global .prime/agent/skills, .agents/skills, package
// `skills/` directories or `pi.skills` entries, and settings `skills` arrays).
// All methodology content is generated; only this config, the package
// metadata/docs/tests, and the compiled extension (src/) are hand-authored.
//
// Scope (ADR-CORE-014, re-verified 2026-08-13 at upstream commit
// 7787f07415d843b9a800f6a4720e0c739bd608e5): skills-first delivery PLUS a small
// verified executable extension (`pi.extensions`, src/extension.ts) covering
// workflow-mode slash commands (/fein, /sonar, /blitz, /mode-clear,
// /maestria-status) and before_agent_start mode prompt injection. Prime's
// recursive-subagent (`rlm`) dispatch and JSON/RPC headless mode remain
// deferred and are NOT claimed anywhere in this projection - the pinned fork
// exposes no public JS extension bridge for `rlm` (it is an IPython-side tool).
// Specialist references (`@adventurer`, ...) become plain skill names so the
// content reads as "load the skill" rather than "spawn an agent".

import type { SyncConfig } from '../core/scripts/lib/config.js';

const AGENT_REF_REPLACES = [
  { from: '@adventurer', to: 'adventurer' },
  { from: '@architect', to: 'architect' },
  { from: '@builder', to: 'builder' },
  { from: '@diagnose', to: 'diagnose' },
  { from: '@planner', to: 'planner' },
  { from: '@reviewer', to: 'reviewer' },
  { from: '@writer', to: 'writer' },
] as const;

// Read-only role notes. Prime Agent has no skill-level tool enforcement (the
// Agent Skills `allowed-tools` field only pre-approves tools and is
// experimental), so these are advisory role intent, never a runtime boundary.
const READ_ONLY_PREPENDS: Record<string, string> = {
  adventurer:
    '**Read-only role (advisory):** in this skills-first package there is no runtime tool enforcement. The role intent stands: you explore, trace, map, and report; you never implement, design, or edit.\n\n',
  planner:
    '**Read-only role (advisory):** in this skills-first package there is no runtime tool enforcement. Produce a structured plan with phases, verification, and rollback points; do not edit files.\n\n',
  reviewer:
    '**Read-only role (advisory):** in this skills-first package there is no runtime tool enforcement. Produce a review report with verdicts; do not fix issues yourself - report them for the builder.\n\n',
};

const ORCHESTRATOR_APPEND = `

## Prime Agent Integration

### Skills

The universal contracts live in the \`global-rules\` skill; load it once at session start, before routing work or loading specialist skills, and apply it throughout the session. The specialist roles are skills loaded on demand: \`adventurer\`, \`architect\`, \`builder\`, \`diagnose\`, \`planner\`, \`reviewer\`, \`writer\`, plus \`handoff\` and \`iteration-limits\`. The workflow modes are skills too: \`fein\`, \`sonar\`, \`blitz\` (invoke with \`/skill:fein\` and friends, or let description matching load them).

### Executable extension (verified subset)

This is a skills-first package: specialist roles are methodology skills, not executable subagents. The package does ship a small compiled Prime/Pi extension (\`pi.extensions\`) covering the workflow-mode slash commands (\`/fein\`, \`/sonar\`, \`/blitz\`, \`/mode-clear\`, \`/maestria-status\`) and mode prompt injection plus project-customization injection on each agent turn via \`before_agent_start\`. Mode selection is session-scoped state (custom session entries); it does not spawn or control agents.

### Deferred: recursive-subagent dispatch

Recursive-subagent (\`rlm\`) dispatch and JSON/RPC headless mode are NOT provided. "Delegate to a specialist" means load the relevant skill and apply its methodology, not spawn a child agent. Prime's \`rlm\` call is an IPython-side tool with no public JS extension bridge in the pinned fork, so this package does not and cannot dispatch subagents.

### Platform notes

- Methodology, skills, and the extension are advisory guidance, not hard security enforcement. The extension performs no tool interception and no filesystem writes. Prime Agent is not a sandbox: it executes model-generated Python and project commands with your user permissions. Restrict use to trusted repositories, skills, and instructions.
- Prime Agent validates skills against the Agent Skills standard: \`name\` and \`description\` are required, unknown frontmatter fields are ignored, and skills with a missing description are not loaded.
`;

const MODE_APPENDS: Record<string, string> = {
  blitz: `
Fast implementation mode. Load the \`orchestrator\` skill if coordination is needed. The \`/blitz\` extension command also activates this mode for the session (a goal argument is forwarded to the agent; the mode prompt is injected on every turn; clear with \`/mode-clear\`). If the user provided a goal after invoking \`blitz\`, implement that goal now.`,
  fein: `
Load the \`orchestrator\` skill for routing and delegation methodology. The \`/fein\` extension command also activates this mode for the session (a goal argument is forwarded to the agent; the mode prompt is injected on every turn; clear with \`/mode-clear\`). If the user provided a goal after invoking \`fein\`, run the full pipeline on that goal now.`,
  sonar: `
Research-only mode. Load the \`orchestrator\` skill for routing and delegation methodology. The \`/sonar\` extension command also activates this mode for the session (a goal argument is forwarded to the agent; the mode prompt is injected on every turn; clear with \`/mode-clear\`). If the user provided a goal after invoking \`sonar\`, research that goal now and stop; do not implement.`,
};

export default {
  default: {
    replace: [...AGENT_REF_REPLACES],
  },
  files: {
    'adventurer.md': {
      frontmatter: {
        description: `Codebase reconnaissance skill for mapping unfamiliar code, tracing call chains, and reporting verified context without implementing changes.`,
        name: 'adventurer',
      },
      output: 'adventurer/SKILL.md',
      prepend: READ_ONLY_PREPENDS.adventurer,
    },
    'architect.md': {
      frontmatter: {
        description: `Architecture decision skill for comparing implementation approaches, boundaries, threat models, and ADR decisions.`,
        name: 'architect',
      },
      output: 'architect/SKILL.md',
    },
    'builder.md': {
      frontmatter: {
        description: `Focused implementation skill for one atomic, verifiable feature, fix, test, or refactor.`,
        name: 'builder',
      },
      output: 'builder/SKILL.md',
    },
    'commands/blitz.md': {
      append: MODE_APPENDS.blitz,
      frontmatter: {
        description:
          'Fast implementation mode - skip optional ceremony for familiar, low-risk work; never waive safety or required review. Load when the user invokes blitz or asks for a fast route.',
        name: 'blitz',
      },
      output: 'blitz/SKILL.md',
      stripFrontmatter: true,
    },
    'commands/fein.md': {
      append: MODE_APPENDS.fein,
      frontmatter: {
        description:
          'Full pipeline mode - reconnaissance or design, implementation, and independent review. Load when the user invokes fein or asks for the complete maestria pipeline.',
        name: 'fein',
      },
      output: 'fein/SKILL.md',
      stripFrontmatter: true,
    },
    'commands/sonar.md': {
      append: MODE_APPENDS.sonar,
      frontmatter: {
        description:
          'Research-only mode - read-only specialist work, then STOP before implementation. Load when the user invokes sonar or asks for research-only work.',
        name: 'sonar',
      },
      output: 'sonar/SKILL.md',
      stripFrontmatter: true,
    },
    'diagnose.md': {
      frontmatter: {
        description: `Systematic regression-tracing skill from symptom and error evidence to root cause, fix, and prevention.`,
        name: 'diagnose',
      },
      output: 'diagnose/SKILL.md',
    },
    'orchestrator.md': {
      append: ORCHESTRATOR_APPEND,
      frontmatter: {
        description: `Maestria workflow dispatcher for routing work, preserving handoffs, and keeping independent review explicit.`,
        name: 'orchestrator',
      },
      output: 'orchestrator/SKILL.md',
      replace: [
        {
          from: 'load project-root `.maestria/workflow.md` then `.maestria/rules.md` using host tools',
          to: 'load the `global-rules` skill plus project-root `.maestria/workflow.md` then `.maestria/rules.md` using host tools',
        },
      ],
    },
    'planner.md': {
      frontmatter: {
        description: `Phased planning skill with dependencies, verification criteria, timelines, and rollback points.`,
        name: 'planner',
      },
      output: 'planner/SKILL.md',
      prepend: READ_ONLY_PREPENDS.planner,
    },
    'reviewer.md': {
      frontmatter: {
        description: `Independent review skill covering correctness, security, performance, maintainability, and quality gates.`,
        name: 'reviewer',
      },
      output: 'reviewer/SKILL.md',
      prepend: READ_ONLY_PREPENDS.reviewer,
    },
    'rules.md': {
      append: `\n\n## Prime Agent Integration\n\nThis package delivers the universal rules as the \`global-rules\` skill. Delivery is skills-first and advisory: methodology and rules are prompt guidance, not security enforcement. The package ships a small executable extension covering workflow-mode commands and mode prompt injection only; JSON/RPC headless modes and recursive-subagent dispatch remain deferred - do not claim them. Prime Agent is not a sandbox - it executes model-generated Python and project commands with your user permissions; restrict use to trusted repositories, skills, and instructions.\n`,
      frontmatter: {
        description: `Universal agent rules contract: universal floors,
orchestration, delegation, context management, handoff, blind review, bounded
autonomy, authorization checkpoints, process lifecycle, and commit and branch
safety.
Load once per session and apply to routing, delegation, review, and commit
decisions.`,
        name: 'global-rules',
      },
      output: 'global-rules/SKILL.md',
      replace: [
        { from: '# Global Agent Rules', to: '# Global Agent Rules - @maestria/prime-agent' },
      ],
    },
    'skills/handoff.md': {
      frontmatter: {
        description: `The handoff contract for inter-specialist delegation.
Load when receiving a task from another specialist, or when handing off work to
the next stage in the pipeline.`,
        name: 'handoff',
      },
      output: 'handoff/SKILL.md',
    },
    'skills/iteration-limits.md': {
      frontmatter: {
        description: `The iteration-limit pattern with verifiable termination
and escalation format.
Load when defining termination conditions for a loop, or when a loop is at risk
of running too long.`,
        name: 'iteration-limits',
      },
      output: 'iteration-limits/SKILL.md',
    },
    'writer.md': {
      frontmatter: {
        description: `Structured documentation skill for READMEs, API docs, architecture documents, changelogs, and decision records.`,
        name: 'writer',
      },
      output: 'writer/SKILL.md',
    },
  },
  output: 'skills',
  source: '../core/agent-directives/specialists',
} satisfies SyncConfig;
