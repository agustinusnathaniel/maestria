// packages/deepseek/sync.config.ts
// DeepSeek Harness projection: derives DSH Agent-Skills from the canonical core
// directives. Generated skills are advisory workflow guidance on their own; the
// package's optional Cordis plugin and the Maestria agent preset add native
// delegation and prompt integration.

import type { FileConfig, SyncConfig } from '../core/scripts/lib/config.js';

const DEEPSEEK_ROLE_REPLACES = [
  { from: '@adventurer', to: 'adventurer' },
  { from: '@architect', to: 'architect' },
  { from: '@builder', to: 'builder' },
  { from: '@diagnose', to: 'diagnose' },
  { from: '@orchestrator', to: 'orchestrator' },
  { from: '@planner', to: 'planner' },
  { from: '@reviewer', to: 'reviewer' },
  { from: '@writer', to: 'writer' },
] as const;

const DEEPSEEK_READ_ONLY_NOTES: Record<string, string> = {
  adventurer:
    '**Read-only role (advisory):** Agent Skills do not grant or deny host tools. Explore, trace, map, and report; never implement, design, or edit while following this role. When the Maestria agent preset is active, prefer the `maestria_adventurer` delegation tool, whose deployment may additionally restrict child tools.\n\n',
  planner:
    '**Read-only role (advisory):** Agent Skills do not grant or deny host tools. Produce a structured plan with phases, verification, and rollback points; do not edit files while following this role. When the Maestria agent preset is active, prefer the `maestria_planner` delegation tool, whose deployment may additionally restrict child tools.\n\n',
  reviewer:
    '**Read-only role (advisory):** Agent Skills do not grant or deny host tools. Review and report findings; do not fix issues yourself while following this role. When the Maestria agent preset is active, prefer the `maestria_reviewer` delegation tool, whose deployment may additionally restrict child tools.\n\n',
};

const ORCHESTRATOR_APPEND = `

## DeepSeek Harness Integration

### Global rules

Load the \`global-rules\` skill once at session start, before routing work or using specialist skills, and apply it throughout the session. When this package's Cordis plugin is mounted with \`injectGlobalRules\`, the rules are already part of the system prompt and the skill is a reference copy.

### Specialist skills and delegation tools

Use the skills below as the specialist workflow profiles. When the Maestria agent preset is active, each specialist is also exposed as a \`maestria_<role>\` subagent delegation tool carrying the specialist's persona; prefer the tool for delegation and use the skill for direct in-session guidance:

| Skill | Delegation tool | Role | Use when |
| --- | --- | --- | --- |
| \`adventurer\` | \`maestria_adventurer\` | Codebase reconnaissance | unfamiliar code, tracing, mapping, or locating behavior |
| \`architect\` | \`maestria_architect\` | Architecture decisions | trade-offs, technology, boundaries, threat model, or ADR decisions |
| \`builder\` | \`maestria_builder\` | Atomic implementation | a concrete feature, bug fix, test, or refactor with no identified uncertainty |
| \`diagnose\` | \`maestria_diagnose\` | Root-cause analysis | a bug, regression, failure, crash, or unclear cause |
| \`planner\` | \`maestria_planner\` | Phased planning | a multi-phase feature, rollout, or migration plan |
| \`reviewer\` | \`maestria_reviewer\` | Independent quality review | post-implementation validation or explicit review |
| \`writer\` | \`maestria_writer\` | Documentation | README, changelog, API docs, or structured prose |

Keep the maker/checker boundary explicit in every handoff: the independent reviewer must not implement its own findings.

### Workflow-mode skills

Use \`fein\` for the full route, \`sonar\` for research-only work, and \`blitz\` for the fast capability-aware route. These are Agent Skills, not slash commands.

### Platform boundary

The generated skills and this package's prompt sections are advisory capabilities, not security enforcement. DeepSeek Harness owns tool restrictions (\`toolFilter\`), sandboxing, approvals, and permission presets; the Maestria preset demonstrates a composition but the host retains control. Do not claim that this integration overrides the host's primary agent or enforces the Maestria methodology.
`;

const skill = (name: string, description: string, extra: Partial<FileConfig> = {}): FileConfig => ({
  ...extra,
  frontmatter: {
    description,
    name,
  },
  output: `${name}/SKILL.md`,
});

export default {
  default: {
    replace: [...DEEPSEEK_ROLE_REPLACES],
  },
  files: {
    'adventurer.md': skill(
      'adventurer',
      'Codebase reconnaissance skill for mapping unfamiliar code, tracing call chains, and reporting verified context without implementing changes.',
      { prepend: DEEPSEEK_READ_ONLY_NOTES.adventurer },
    ),
    'architect.md': skill(
      'architect',
      'Architecture decision skill for comparing implementation approaches, boundaries, threat models, and ADR decisions.',
    ),
    'builder.md': skill(
      'builder',
      'Focused implementation skill for one atomic, verifiable feature, fix, test, or refactor.',
    ),
    'commands/blitz.md': skill(
      'blitz',
      'Fast capability-aware workflow mode that skips optional ceremony without waiving safety or review.',
      { stripFrontmatter: true },
    ),
    'commands/fein.md': skill(
      'fein',
      'Full workflow mode for reconnaissance or design, implementation, and independent review.',
      { stripFrontmatter: true },
    ),
    'commands/sonar.md': skill(
      'sonar',
      'Research-only workflow mode for read-only specialist work that stops before implementation.',
      { stripFrontmatter: true },
    ),
    'diagnose.md': skill(
      'diagnose',
      'Systematic regression-tracing skill from symptom and error evidence to root cause, fix, and prevention.',
    ),
    'orchestrator.md': skill(
      'orchestrator',
      'Maestria workflow dispatcher for routing work, preserving handoffs, and keeping independent review explicit.',
      { append: ORCHESTRATOR_APPEND },
    ),
    'planner.md': skill(
      'planner',
      'Phased planning skill with dependencies, verification criteria, timelines, and rollback points.',
      { prepend: DEEPSEEK_READ_ONLY_NOTES.planner },
    ),
    'reviewer.md': skill(
      'reviewer',
      'Independent review skill covering correctness, security, performance, maintainability, and quality gates.',
      { prepend: DEEPSEEK_READ_ONLY_NOTES.reviewer },
    ),
    'rules.md': skill(
      'global-rules',
      'Universal rules for evidence, safety, authorization, delegation, review, bounded repair, and branch discipline.',
    ),
    'skills/handoff.md': skill(
      'handoff',
      'Concise handoff contract for passing outcome, constraints, evidence, blockers, and next steps between workflow stages.',
    ),
    'skills/iteration-limits.md': skill(
      'iteration-limits',
      'Verifiable termination and bounded repair guidance for loops, reviews, and repeated implementation attempts.',
    ),
    'writer.md': skill(
      'writer',
      'Structured documentation skill for READMEs, API docs, architecture documents, changelogs, and decision records.',
    ),
  },
  output: 'skills',
  source: '../core/agent-directives/specialists',
} satisfies SyncConfig;
