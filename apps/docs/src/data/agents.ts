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
  icon: string;
}

export const agents: Agent[] = [
  {
    id: 'orchestrator',
    name: 'Orchestrator',
    role: 'Routes tasks to specialists, manages commit protocol',
    description:
      'The dispatcher that never implements. Routes every task to the right specialist, enforces maker/checker split, and manages the commit protocol.',
    icon: '🎯',
  },
  {
    id: 'adventurer',
    name: 'Adventurer',
    role: 'Codebase reconnaissance, deep code understanding',
    description:
      'Maps unknown territory so downstream specialists can work with full context. Explores code paths, traces dependencies, and produces structured reconnaissance reports.',
    icon: '🗺️',
  },
  {
    id: 'architect',
    name: 'Architect',
    role: 'Architecture decisions, trade-off analysis, ADRs',
    description:
      'Makes architecture decisions systematically. Clarifies the problem, presents options with trade-offs, and documents decisions as Architecture Decision Records.',
    icon: '🏛️',
  },
  {
    id: 'builder',
    name: 'Builder',
    role: 'Focused implementation, single-task execution',
    description:
      'Handles exactly one atomic task per invocation. Reads context, edits minimally, verifies with tests, and reports what changed and why.',
    icon: '🔧',
  },
  {
    id: 'diagnose',
    name: 'Diagnose',
    role: 'Systematic bug tracing, root cause analysis',
    description:
      'Traces bugs systematically from error to source, source to git history, and history to blast radius. Finds root cause and all similar problems in the codebase.',
    icon: '🔍',
  },
  {
    id: 'planner',
    name: 'Planner',
    role: 'Implementation plans with phased milestones',
    description:
      'Creates implementation plans with goals, phased milestones, atomic tasks, verification criteria, and rollback points for complex features.',
    icon: '📋',
  },
  {
    id: 'reviewer',
    name: 'Reviewer',
    role: 'Code review with quality gates',
    description:
      'Reviews code for quality, correctness, security, and maintainability. Uses multi-lens review swarms for non-trivial changes, prioritizes observation over reasoning, and categorizes issues with [fix]/[dismiss]/[escalate] triage. Enforces the maker/checker split.',
    icon: '✅',
  },
  {
    id: 'writer',
    name: 'Writer',
    role: 'Documentation following structured patterns',
    description:
      'Writes documentation following structured patterns. Covers purpose, usage, and details with progressive disclosure and clear, human-readable prose.',
    icon: '✍️',
  },
];
