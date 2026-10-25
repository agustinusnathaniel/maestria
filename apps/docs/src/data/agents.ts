/**
 * WARNING: This data is manually maintained.
 * Source of truth: packages/core/agent-directives/specialists/*.md
 * Update this file when specialist definitions change.
 */

export interface Agent {
  id: string;
  name: string;
  role: string;
  description: string;
  scope: string;
  artifact: string;
  constraint: string;
  icon: string;
}

export const agents: Agent[] = [
  {
    artifact: 'Route assignments, commit protocol',
    constraint: 'Maker/checker split enforced',
    description:
      'The dispatcher selects the smallest safe route for each turn: it executes known low-risk work directly, delegates specialist work with concise briefs, integrates results, enforces the maker/checker split, and manages the commit protocol.',
    icon: '🎯',
    id: 'orchestrator',
    name: 'Orchestrator',
    role: 'Routes tasks to specialists, manages commit protocol',
    scope: 'Routes work; executes direct-route tasks itself',
  },
  {
    artifact: 'Reconnaissance report',
    constraint: 'Read-only - no edits',
    description:
      'Maps unknown territory so downstream specialists can work with full context. Explores code paths, traces dependencies, produces structured reconnaissance reports, and loads the diagnose skill for a read-only diagnosis, stopping at the supported root cause and recommended repair.',
    icon: '🗺️',
    id: 'adventurer',
    name: 'Adventurer',
    role: 'Codebase reconnaissance, read-only diagnosis',
    scope: 'Unfamiliar code territory',
  },
  {
    artifact: 'Decision record (ADR)',
    constraint: 'Decisions documented, not coded',
    description:
      'Makes architecture decisions systematically and writes the phased plans that implement them. Clarifies the problem, presents options with trade-offs, and documents decisions as Architecture Decision Records.',
    icon: '🏛️',
    id: 'architect',
    name: 'Architect',
    role: 'Architecture decisions and phased plans',
    scope: 'Approach selection, trade-offs',
  },
  {
    artifact: 'Implementation + tests',
    constraint: 'Never reviews its own work',
    description:
      'Handles exactly one atomic task per invocation, including documentation. Reads context, edits minimally, verifies with tests, loads the diagnose skill when the cause is not established and docs-update for prose, and reports what changed and why.',
    icon: '🔧',
    id: 'builder',
    name: 'Builder',
    role: 'Focused implementation and documentation',
    scope: 'One atomic task',
  },
  {
    artifact: 'Review verdict',
    constraint: 'Sees work fresh - independent',
    description:
      'Runs one general review for quality, correctness, security, and maintainability, adding specialist lenses only for matching security, performance, architecture, or UX risk. Preserves blind review, lens exclusivity, observation over reasoning, and [fix]/[dismiss]/[escalate] triage. Enforces the maker/checker split.',
    icon: '✅',
    id: 'reviewer',
    name: 'Reviewer',
    role: 'Code review with quality gates',
    scope: 'Pre-merge quality gates',
  },
];
