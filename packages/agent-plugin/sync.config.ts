// packages/agent-plugin/sync.config.ts
// Portable Agent Plugins v1 projection: derives only standard Agent Skills
// from the canonical directives. Runtime-specific agents, commands, hooks,
// permissions, and executable extensions remain in native platform packages.

import type { FileConfig, SyncConfig } from '../core/scripts/lib/config.js';

const PORTABLE_ROLE_REPLACES = [
  { from: '@adventurer', to: 'adventurer' },
  { from: '@architect', to: 'architect' },
  { from: '@builder', to: 'builder' },
  { from: '@diagnose', to: 'diagnose' },
  { from: '@orchestrator', to: 'orchestrator' },
  { from: '@planner', to: 'planner' },
  { from: '@reviewer', to: 'reviewer' },
  { from: '@writer', to: 'writer' },
] as const;

const PORTABLE_BOUNDARY_NOTE = `

## Portable Agent Plugin Boundary

This package declares Agent Skills only. It does not declare executable agents, commands, hooks, MCP servers, or client-specific extensions. The host decides how skills are discovered and invoked, how delegation and session state work, and which tools or permissions are available. The role boundaries in this package are methodology guidance, not a security boundary.
`;

const PORTABLE_READ_ONLY_NOTES: Record<string, string> = {
  adventurer:
    '**Read-only role (advisory):** Agent Skills do not grant or deny host tools. Explore, trace, map, and report; never implement, design, or edit while following this role.\n\n',
  planner:
    '**Read-only role (advisory):** Agent Skills do not grant or deny host tools. Produce a structured plan with phases, verification, and rollback points; do not edit files while following this role.\n\n',
  reviewer:
    '**Read-only role (advisory):** Agent Skills do not grant or deny host tools. Review and report findings; do not fix issues yourself while following this role.\n\n',
};

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
    replace: [...PORTABLE_ROLE_REPLACES],
  },
  files: {
    'adventurer.md': skill(
      'adventurer',
      'Codebase reconnaissance skill for mapping unfamiliar code, tracing call chains, and reporting verified context without implementing changes.',
      { prepend: PORTABLE_READ_ONLY_NOTES.adventurer },
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
      { append: PORTABLE_BOUNDARY_NOTE },
    ),
    'planner.md': skill(
      'planner',
      'Phased planning skill with dependencies, verification criteria, timelines, and rollback points.',
      { prepend: PORTABLE_READ_ONLY_NOTES.planner },
    ),
    'reviewer.md': skill(
      'reviewer',
      'Independent review skill covering correctness, security, performance, maintainability, and quality gates.',
      { prepend: PORTABLE_READ_ONLY_NOTES.reviewer },
    ),
    'rules.md': skill(
      'global-rules',
      'Universal rules for evidence, safety, authorization, delegation, review, bounded repair, and branch discipline.',
      { append: PORTABLE_BOUNDARY_NOTE },
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
