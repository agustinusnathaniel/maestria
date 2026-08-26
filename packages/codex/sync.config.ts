// packages/codex/sync.config.ts
// Codex CLI projection: derives Codex plugin skills from the canonical core
// directives. Generated skills are advisory workflow guidance; Codex runtime
// capabilities and trust controls remain outside this package.

import type { SyncConfig } from '../core/scripts/lib/config.js';

// Codex plugin components are namespaced by the plugin manifest name (`maestria`).
const CODEX_COMPONENT_REPLACES = [
  { from: '@adventurer', to: '$maestria:adventurer' },
  { from: '@architect', to: '$maestria:architect' },
  { from: '@builder', to: '$maestria:builder' },
  { from: '@diagnose', to: '$maestria:diagnose' },
  { from: '@planner', to: '$maestria:planner' },
  { from: '@reviewer', to: '$maestria:reviewer' },
  { from: '@writer', to: '$maestria:writer' },
  { from: '@orchestrator', to: '$maestria:orchestrator' },
] as const;

const CODEX_READ_ONLY_NOTES: Record<string, string> = {
  adventurer:
    '**Codex role note (advisory):** Use this skill for read-only reconnaissance. The Codex host may still expose write-capable tools; this skill cannot enforce a tool restriction, so do not edit or implement while following it.\n\n',
  planner:
    '**Codex role note (advisory):** Use this skill for planning only. The Codex host may still expose write-capable tools; this skill cannot enforce a tool restriction, so do not edit production files while following it.\n\n',
  reviewer:
    '**Codex role note (advisory):** Use this skill for independent review only. The Codex host may still expose write-capable tools; this skill cannot enforce a tool restriction, so report findings instead of fixing them.\n\n',
};

const ORCHESTRATOR_APPEND = `

## Codex CLI Integration

### Global rules

Load the \`$maestria:global-rules\` skill once at session start, before routing work or using specialist skills, and apply it throughout the session. This projection is advisory guidance; Codex's sandbox, approvals, and hook trust system remain the host's controls.

### Specialist skills

Use the namespaced skills below as the specialist workflow profiles:

| Skill | Role | Use when |
| --- | --- | --- |
| \`$maestria:adventurer\` | Codebase reconnaissance | unfamiliar code, tracing, mapping, or locating behavior |
| \`$maestria:architect\` | Architecture decisions | trade-offs, technology, boundaries, threat model, or ADR decisions |
| \`$maestria:builder\` | Atomic implementation | a concrete feature, bug fix, test, or refactor with no identified uncertainty |
| \`$maestria:diagnose\` | Root-cause analysis | a bug, regression, failure, crash, or unclear cause |
| \`$maestria:planner\` | Phased planning | a multi-phase feature, rollout, or migration plan |
| \`$maestria:reviewer\` | Independent quality review | post-implementation validation or explicit review |
| \`$maestria:writer\` | Documentation | README, changelog, API docs, or structured prose |

Codex supports subagent workflows, but a skill does not create or enforce a custom subagent role. Ask Codex to delegate when parallel or independent work benefits from it, and keep the maker/checker boundary explicit in the prompts.

### Optional native custom agents

The \`$maestria:*\` references above are skills, not Codex agent definitions. When \`maestria configure codex\` creates native custom-agent files, delegate to the corresponding bare agent names (\`adventurer\`, \`architect\`, \`builder\`, \`diagnose\`, \`planner\`, \`reviewer\`, or \`writer\`) when a separate role is useful. Without those files, use Codex's built-in agents or explicit delegation prompts.

### Workflow-mode skills

Use \`$maestria:fein\` for the full route, \`$maestria:sonar\` for research-only work, and \`$maestria:blitz\` for the fast capability-aware route. These are skills rather than Codex slash commands.

### Platform boundary

This package contains no hooks, MCP server, installer, model configuration, or AGENTS.md writer. The companion \`maestria configure codex\` command writes native custom-agent TOML outside the package when explicitly requested. Skills and plugin loading are advisory capabilities, not security enforcement; native custom-agent sandbox settings are the host's boundary. Do not claim that this plugin alone makes a role read-only, guarantees delegation, or enforces the Maestria methodology.
`;

export default {
  source: '../core/agent-directives/specialists',
  output: 'skills',

  default: {
    replace: [...CODEX_COMPONENT_REPLACES],
  },

  files: {
    'adventurer.md': {
      output: 'adventurer/SKILL.md',
      prepend: CODEX_READ_ONLY_NOTES.adventurer,
      frontmatter: {
        name: 'adventurer',
        description:
          'Codebase reconnaissance workflow for mapping unfamiliar code, tracing call chains, and reporting verified context without implementing changes.',
      },
    },
    'architect.md': {
      output: 'architect/SKILL.md',
      frontmatter: {
        name: 'architect',
        description:
          'Architecture decision workflow for comparing implementation approaches, boundaries, threat models, and ADR decisions.',
      },
    },
    'builder.md': {
      output: 'builder/SKILL.md',
      frontmatter: {
        name: 'builder',
        description:
          'Focused implementation workflow for one atomic, verifiable feature, fix, test, or refactor.',
      },
    },
    'diagnose.md': {
      output: 'diagnose/SKILL.md',
      frontmatter: {
        name: 'diagnose',
        description:
          'Systematic regression-tracing workflow from symptom and error evidence to root cause, fix, and prevention.',
      },
    },
    'planner.md': {
      output: 'planner/SKILL.md',
      prepend: CODEX_READ_ONLY_NOTES.planner,
      frontmatter: {
        name: 'planner',
        description:
          'Phased implementation planning workflow with dependencies, verification criteria, timelines, and rollback points.',
      },
    },
    'reviewer.md': {
      output: 'reviewer/SKILL.md',
      prepend: CODEX_READ_ONLY_NOTES.reviewer,
      frontmatter: {
        name: 'reviewer',
        description:
          'Independent code review workflow covering correctness, security, performance, maintainability, and quality gates.',
      },
    },
    'writer.md': {
      output: 'writer/SKILL.md',
      frontmatter: {
        name: 'writer',
        description:
          'Structured documentation workflow for READMEs, API docs, architecture documents, changelogs, and decision records.',
      },
    },
    'orchestrator.md': {
      output: 'orchestrator/SKILL.md',
      frontmatter: {
        name: 'orchestrator',
        description:
          'Maestria workflow dispatcher for Codex CLI: route work, use specialist skills, preserve handoffs, and keep independent review explicit.',
      },
      append: ORCHESTRATOR_APPEND,
    },
    'rules.md': {
      output: 'global-rules/SKILL.md',
      frontmatter: {
        name: 'global-rules',
        description:
          'Universal Maestria rules for evidence, safety, authorization, delegation, review, bounded repair, and branch discipline.',
      },
      replace: [{ from: '# Global Agent Rules', to: '# Global Agent Rules - @maestria/codex' }],
    },
    'skills/handoff.md': {
      output: 'handoff/SKILL.md',
      frontmatter: {
        name: 'handoff',
        description:
          'Concise handoff contract for passing outcome, constraints, evidence, blockers, and next steps between workflow stages.',
      },
    },
    'skills/iteration-limits.md': {
      output: 'iteration-limits/SKILL.md',
      frontmatter: {
        name: 'iteration-limits',
        description:
          'Verifiable termination and bounded repair guidance for loops, reviews, and repeated implementation attempts.',
      },
    },
    'commands/fein.md': {
      output: 'fein/SKILL.md',
      stripFrontmatter: true,
      frontmatter: {
        name: 'fein',
        description:
          'Full Maestria pipeline: reconnaissance, design, implementation, and independent review.',
      },
    },
    'commands/sonar.md': {
      output: 'sonar/SKILL.md',
      stripFrontmatter: true,
      frontmatter: {
        name: 'sonar',
        description:
          'Research-only Maestria route using read-only specialist skills, then stop before implementation.',
      },
    },
    'commands/blitz.md': {
      output: 'blitz/SKILL.md',
      stripFrontmatter: true,
      frontmatter: {
        name: 'blitz',
        description:
          'Fast capability-aware Maestria route that skips optional ceremony without waiving safety or review.',
      },
    },
  },
} satisfies SyncConfig;
