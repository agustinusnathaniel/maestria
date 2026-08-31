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

Codex supports subagent workflows. Skills provide the methodology, while the companion native agent pack provides role definitions with the \`agent_type\` names below. Keep the maker/checker boundary explicit in every handoff.

### Native custom agents

The Maestria CLI installs the bundled native agent TOMLs into \`$CODEX_HOME/agents/\` using collision-resistant names: \`maestria-adventurer\`, \`maestria-architect\`, \`maestria-builder\`, \`maestria-diagnose\`, \`maestria-planner\`, \`maestria-reviewer\`, and \`maestria-writer\`. Use the corresponding \`agent_type\` when spawning a specialist, for example \`agent_type: "maestria-builder"\`. \`maestria configure codex\` updates their model settings without changing the role instructions. If the native pack is not installed, use the namespaced skills with Codex's built-in agents or explicit delegation prompts.

### Workflow-mode skills

Use \`$maestria:fein\` for the full route, \`$maestria:sonar\` for research-only work, and \`$maestria:blitz\` for the fast capability-aware route. These are skills rather than Codex slash commands.

### Platform boundary

The Codex plugin manifest declares skills only; the companion Maestria CLI installs the package's native custom-agent TOML files, manages their model settings, and adds a marked global orchestration block to Codex's active AGENTS.md instructions. The package contains no hooks or MCP server. Skills and instruction guidance are advisory capabilities, not security enforcement; native custom-agent sandbox settings are the host's boundary. Do not claim that this integration overrides Codex's primary agent or enforces the Maestria methodology.
`;

export default {
  default: {
    replace: [...CODEX_COMPONENT_REPLACES],
  },
  files: {
    'adventurer.md': {
      frontmatter: {
        description:
          'Codebase reconnaissance workflow for mapping unfamiliar code, tracing call chains, and reporting verified context without implementing changes.',
        name: 'adventurer',
      },
      output: 'adventurer/SKILL.md',
      prepend: CODEX_READ_ONLY_NOTES.adventurer,
    },
    'architect.md': {
      frontmatter: {
        description:
          'Architecture decision workflow for comparing implementation approaches, boundaries, threat models, and ADR decisions.',
        name: 'architect',
      },
      output: 'architect/SKILL.md',
    },
    'builder.md': {
      frontmatter: {
        description:
          'Focused implementation workflow for one atomic, verifiable feature, fix, test, or refactor.',
        name: 'builder',
      },
      output: 'builder/SKILL.md',
    },
    'commands/blitz.md': {
      frontmatter: {
        description:
          'Fast capability-aware Maestria route that skips optional ceremony without waiving safety or review.',
        name: 'blitz',
      },
      output: 'blitz/SKILL.md',
      stripFrontmatter: true,
    },
    'commands/fein.md': {
      frontmatter: {
        description:
          'Full Maestria pipeline: reconnaissance, design, implementation, and independent review.',
        name: 'fein',
      },
      output: 'fein/SKILL.md',
      stripFrontmatter: true,
    },
    'commands/sonar.md': {
      frontmatter: {
        description:
          'Research-only Maestria route using read-only specialist skills, then stop before implementation.',
        name: 'sonar',
      },
      output: 'sonar/SKILL.md',
      stripFrontmatter: true,
    },
    'diagnose.md': {
      frontmatter: {
        description:
          'Systematic regression-tracing workflow from symptom and error evidence to root cause, fix, and prevention.',
        name: 'diagnose',
      },
      output: 'diagnose/SKILL.md',
    },
    'orchestrator.md': {
      append: ORCHESTRATOR_APPEND,
      frontmatter: {
        description:
          'Maestria workflow dispatcher for Codex CLI: route work, use specialist skills, preserve handoffs, and keep independent review explicit.',
        name: 'orchestrator',
      },
      output: 'orchestrator/SKILL.md',
    },
    'planner.md': {
      frontmatter: {
        description:
          'Phased implementation planning workflow with dependencies, verification criteria, timelines, and rollback points.',
        name: 'planner',
      },
      output: 'planner/SKILL.md',
      prepend: CODEX_READ_ONLY_NOTES.planner,
    },
    'reviewer.md': {
      frontmatter: {
        description:
          'Independent code review workflow covering correctness, security, performance, maintainability, and quality gates.',
        name: 'reviewer',
      },
      output: 'reviewer/SKILL.md',
      prepend: CODEX_READ_ONLY_NOTES.reviewer,
    },
    'rules.md': {
      frontmatter: {
        description:
          'Universal Maestria rules for evidence, safety, authorization, delegation, review, bounded repair, and branch discipline.',
        name: 'global-rules',
      },
      output: 'global-rules/SKILL.md',
      replace: [{ from: '# Global Agent Rules', to: '# Global Agent Rules - @maestria/codex' }],
    },
    'skills/handoff.md': {
      frontmatter: {
        description:
          'Concise handoff contract for passing outcome, constraints, evidence, blockers, and next steps between workflow stages.',
        name: 'handoff',
      },
      output: 'handoff/SKILL.md',
    },
    'skills/iteration-limits.md': {
      frontmatter: {
        description:
          'Verifiable termination and bounded repair guidance for loops, reviews, and repeated implementation attempts.',
        name: 'iteration-limits',
      },
      output: 'iteration-limits/SKILL.md',
    },
    'writer.md': {
      frontmatter: {
        description:
          'Structured documentation workflow for READMEs, API docs, architecture documents, changelogs, and decision records.',
        name: 'writer',
      },
      output: 'writer/SKILL.md',
    },
  },
  output: 'skills',
  source: '../core/agent-directives/specialists',
} satisfies SyncConfig;
