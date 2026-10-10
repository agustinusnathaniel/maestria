// Native claude-code resources in the consolidated plugin.
// Sync config: derives Claude Code plugin agents and skills from canonical
// core directives. All methodology content is generated; only this config and
// the package metadata/docs/tests are hand-authored.

import type { SyncConfig } from '../../../core/scripts/lib/config.js';

// Plugin manifest name is `maestria` (see .claude-plugin/plugin.json), so
// every component is referenced by its namespaced identifier, e.g.
// `maestria:builder` for the builder agent and `maestria:global-rules` for
// the global-rules skill.

// Shared skills preloaded into each specialist agent. The namespaced
// identifiers match the plugin manifest name (`maestria`).
const GLOBAL_RULES_PRELOAD = ['maestria:global-rules'];

export default {
  files: {
    'adventurer.md': {
      frontmatter: {
        description: `Codebase reconnaissance agent for mapping unfamiliar code, tracing call chains, and reporting verified context without implementing changes.`,
        disallowedTools: 'Write, Edit',
        model: 'inherit',
        name: 'adventurer',
        skills: [...GLOBAL_RULES_PRELOAD, 'maestria:adventurer'],
      },
      source: '../../../core/agent-directives/agents/claude-wrapper.md',
    },
    'architect.md': {
      frontmatter: {
        description: `Architecture decision agent for comparing implementation approaches, boundaries, threat models, and ADR decisions.`,
        model: 'inherit',
        name: 'architect',
        skills: [...GLOBAL_RULES_PRELOAD, 'maestria:architect'],
      },
      source: '../../../core/agent-directives/agents/claude-wrapper.md',
    },
    'builder.md': {
      frontmatter: {
        description: `Focused implementation agent for one atomic, verifiable feature, fix, test, or refactor.`,
        model: 'inherit',
        name: 'builder',
        skills: [...GLOBAL_RULES_PRELOAD, 'maestria:builder'],
      },
      source: '../../../core/agent-directives/agents/claude-wrapper.md',
    },
    'diagnose.md': {
      frontmatter: {
        description: `Systematic regression-tracing agent from symptom and error evidence to root cause, fix, and prevention.`,
        model: 'inherit',
        name: 'diagnose',
        skills: [...GLOBAL_RULES_PRELOAD, 'maestria:diagnose'],
      },
      source: '../../../core/agent-directives/agents/claude-wrapper.md',
    },
    'orchestrator.md': {
      output: '../../integrations/claude-code/context.md',
      source: '../../../core/agent-directives/integrations/claude-code.md',
    },
    'planner.md': {
      frontmatter: {
        description: `Phased planning agent with dependencies, verification criteria, timelines, and rollback points.`,
        disallowedTools: 'Write, Edit',
        model: 'inherit',
        name: 'planner',
        skills: [...GLOBAL_RULES_PRELOAD, 'maestria:planner'],
      },
      source: '../../../core/agent-directives/agents/claude-wrapper.md',
    },
    'reviewer.md': {
      frontmatter: {
        description: `Independent review agent covering correctness, security, performance, maintainability, and quality gates.`,
        disallowedTools: 'Write, Edit',
        model: 'inherit',
        name: 'reviewer',
        skills: [...GLOBAL_RULES_PRELOAD, 'maestria:reviewer'],
      },
      source: '../../../core/agent-directives/agents/claude-wrapper.md',
    },
    'writer.md': {
      frontmatter: {
        description: `Structured documentation agent for READMEs, API docs, architecture documents, changelogs, and decision records.`,
        model: 'inherit',
        name: 'writer',
        skills: [...GLOBAL_RULES_PRELOAD, 'maestria:writer'],
      },
      source: '../../../core/agent-directives/agents/claude-wrapper.md',
    },
  },
  output: '../../agents/claude-code',
  source: '../../../core/agent-directives/specialists',
} satisfies SyncConfig;
