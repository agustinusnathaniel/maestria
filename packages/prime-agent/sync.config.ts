// packages/prime-agent/sync.config.ts
// Sync config: derives Prime Agent Agent Skills from canonical core directives.
// Prime Agent implements the Agent Skills standard (SKILL.md + frontmatter with
// required `name` and `description`); every skill is emitted as
// skills/<name>/SKILL.md so it is discoverable in every documented Prime skill
// location (project/global .prime/agent/skills, .agents/skills, package
// `skills/` directories or `pi.skills` entries, and settings `skills` arrays).
// All methodology content is generated; only this config and the package
// metadata/docs/tests are hand-authored.
//
// Scope: skills-first delivery only (ADR-CORE-014). Prime's executable
// extension - JSON/RPC headless modes and recursive-subagent (`rlm`) dispatch -
// is deferred and is NOT claimed anywhere in this projection. Specialist
// references (`@adventurer`, ...) become plain skill names so the content reads
// as "load the skill" rather than "spawn an agent".

import type { SyncConfig } from '../core/scripts/lib/config.js';

const AGENT_REF_REPLACES = [
  { from: '@adventurer', to: 'adventurer' },
  { from: '@architect', to: 'architect' },
  { from: '@builder', to: 'builder' },
  { from: '@diagnose', to: 'diagnose' },
  { from: '@planner', to: 'planner' },
  { from: '@reviewer', to: 'reviewer' },
  { from: '@writer', to: 'writer' },
  { from: '@orchestrator', to: 'orchestrator' },
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

The universal contracts live in the \`global-rules\` skill; load it once per session when you need the full contract text. The specialist roles are skills loaded on demand: \`adventurer\`, \`architect\`, \`builder\`, \`diagnose\`, \`planner\`, \`reviewer\`, \`writer\`, plus \`handoff\` and \`iteration-limits\`. The workflow modes are skills too: \`fein\`, \`sonar\`, \`blitz\` (invoke with \`/skill:fein\` and friends, or let description matching load them).

### Advisory delivery, not executable dispatch

This is a skills-first package: specialist roles are methodology skills, not executable subagents. There is no recursive-subagent dispatch, no JSON/RPC headless mode, and no agent tool in this package - Prime's executable extension is deferred. "Delegate to a specialist" means load the relevant skill and apply its methodology, not spawn a child agent.

### Platform notes

- Methodology and skills are advisory guidance, not hard security enforcement. Prime Agent is not a sandbox: it executes model-generated Python and project commands with your user permissions. Restrict use to trusted repositories, skills, and instructions.
- Prime Agent validates skills against the Agent Skills standard: \`name\` and \`description\` are required, unknown frontmatter fields are ignored, and skills with a missing description are not loaded.
`;

const MODE_APPENDS: Record<string, string> = {
  fein: `
Load the \`orchestrator\` skill for routing and delegation methodology. If the user provided a goal after invoking \`fein\`, run the full pipeline on that goal now.`,
  sonar: `
Research-only mode. Load the \`orchestrator\` skill for routing and delegation methodology. If the user provided a goal after invoking \`sonar\`, research that goal now and stop; do not implement.`,
  blitz: `
Fast implementation mode. Load the \`orchestrator\` skill if coordination is needed. If the user provided a goal after invoking \`blitz\`, implement that goal now.`,
};

export default {
  source: '../core/agent-directives/specialists',
  output: 'skills',

  default: {
    replace: [...AGENT_REF_REPLACES],
  },

  files: {
    'adventurer.md': {
      output: 'adventurer/SKILL.md',
      prepend: READ_ONLY_PREPENDS.adventurer,
      frontmatter: {
        name: 'adventurer',
        description: `Codebase reconnaissance skill. Maps unknown territory -
traces call chains, maps module relationships, generates structured recon
reports for downstream work. Read-only role intent: exploration and reporting
only, never implementation or design.
Use for: understanding unfamiliar code, tracing dependencies, gathering context
before implementation, investigating module structures.`,
      },
    },
    'architect.md': {
      output: 'architect/SKILL.md',
      frontmatter: {
        name: 'architect',
        description: `Architecture decisions using decision matrices and ADRs.
Evaluates options with weighted criteria, clarifies business context first.
Use for: technology choices, implementation approaches, trade-off analysis,
threat modeling, or ADR decisions.`,
      },
    },
    'builder.md': {
      output: 'builder/SKILL.md',
      frontmatter: {
        name: 'builder',
        description: `Focused implementation skill for atomic tasks. Executes
one verifiable unit of work with minimal context and a clean diff.
Use for: targeted fixes, feature implementation, refactors, adding tests.`,
      },
    },
    'diagnose.md': {
      output: 'diagnose/SKILL.md',
      frontmatter: {
        name: 'diagnose',
        description: `Systematic 6-step regression tracing: from error message
to root cause to prevention.
Use for: cryptic errors, regressions, production bugs, unclear root causes.`,
      },
    },
    'planner.md': {
      output: 'planner/SKILL.md',
      prepend: READ_ONLY_PREPENDS.planner,
      frontmatter: {
        name: 'planner',
        description: `Create detailed implementation plans with phased
dependencies, timelines, verifiable success criteria, and rollback points.
Breaks complex features into verifiable milestones.
Use for: complex features requiring multi-phase execution, when the plan needs
review before building.`,
      },
    },
    'reviewer.md': {
      output: 'reviewer/SKILL.md',
      prepend: READ_ONLY_PREPENDS.reviewer,
      frontmatter: {
        name: 'reviewer',
        description: `Code review with quality gates. Reviews for correctness,
edge cases, security, performance, maintainability, and adherence to
conventions; provides specific, actionable feedback and preserves blind review.
Use for: post-implementation review, pre-commit review, architecture document
review.`,
      },
    },
    'writer.md': {
      output: 'writer/SKILL.md',
      frontmatter: {
        name: 'writer',
        description: `Documentation writing following structured patterns.
Creates clear, comprehensive docs for code, APIs, and systems.
Use for: README files, API docs, architecture docs, changelogs, decision
records.`,
      },
    },
    'orchestrator.md': {
      output: 'orchestrator/SKILL.md',
      frontmatter: {
        name: 'orchestrator',
        description: `Maestria methodology dispatcher for Prime Agent. Routes
work (direct/focused/full), selects and loads the specialist skills
(adventurer, architect, builder, diagnose, planner, reviewer, writer), and
applies the maker/checker split, handoff contracts, and workflow modes
(fein/sonar/blitz).
Use for multi-step or multi-file work, planning, review, debugging,
architecture decisions, or documentation.`,
      },
      replace: [
        {
          from: '`.maestria/workflow.md` and `.maestria/rules.md`',
          to: 'the `global-rules` skill',
        },
      ],
      append: ORCHESTRATOR_APPEND,
    },
    'rules.md': {
      output: 'global-rules/SKILL.md',
      frontmatter: {
        name: 'global-rules',
        description: `Universal agent rules contract: universal floors,
orchestration, delegation, context management, handoff, blind review, bounded
autonomy, authorization checkpoints, process lifecycle, and commit and branch
safety.
Load once per session and apply to routing, delegation, review, and commit
decisions.`,
      },
      replace: [
        { from: '# Global Agent Rules', to: '# Global Agent Rules - @maestria/prime-agent' },
      ],
      append: `\n\n## Prime Agent Integration\n\nThis package delivers the universal rules as the \`global-rules\` skill. Delivery is skills-first and advisory: methodology and rules are prompt guidance, not security enforcement. Prime Agent is not a sandbox - it executes model-generated Python and project commands with your user permissions; restrict use to trusted repositories, skills, and instructions. There is no executable extension in this package (JSON/RPC headless modes and recursive-subagent dispatch are deferred); do not claim it.\n`,
    },
    'skills/handoff.md': {
      output: 'handoff/SKILL.md',
      frontmatter: {
        name: 'handoff',
        description: `The handoff contract for inter-specialist delegation.
Load when receiving a task from another specialist, or when handing off work to
the next stage in the pipeline.`,
      },
    },
    'skills/iteration-limits.md': {
      output: 'iteration-limits/SKILL.md',
      frontmatter: {
        name: 'iteration-limits',
        description: `The iteration-limit pattern with verifiable termination
and escalation format.
Load when defining termination conditions for a loop, or when a loop is at risk
of running too long.`,
      },
    },
    'commands/fein.md': {
      output: 'fein/SKILL.md',
      stripFrontmatter: true,
      frontmatter: {
        name: 'fein',
        description:
          'Full pipeline mode - reconnaissance or design, implementation, and independent review. Load when the user invokes fein or asks for the complete maestria pipeline.',
      },
      append: MODE_APPENDS.fein,
    },
    'commands/sonar.md': {
      output: 'sonar/SKILL.md',
      stripFrontmatter: true,
      frontmatter: {
        name: 'sonar',
        description:
          'Research-only mode - read-only specialist work, then STOP before implementation. Load when the user invokes sonar or asks for research-only work.',
      },
      append: MODE_APPENDS.sonar,
    },
    'commands/blitz.md': {
      output: 'blitz/SKILL.md',
      stripFrontmatter: true,
      frontmatter: {
        name: 'blitz',
        description:
          'Fast implementation mode - skip optional ceremony for familiar, low-risk work; never waive safety or required review. Load when the user invokes blitz or asks for a fast route.',
      },
      append: MODE_APPENDS.blitz,
    },
  },
} satisfies SyncConfig;
