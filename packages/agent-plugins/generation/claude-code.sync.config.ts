import type { SyncConfig } from '../../core/scripts/lib/config.js';

const GLOBAL_RULES_PRELOAD = ['maestria:global-rules'];
const CLAUDE_WRAPPER = '../../core/agent-directives/agents/claude-wrapper.md';

const profile = (name: string, description: string, readOnly = false) => ({
  frontmatter: {
    description,
    ...(readOnly ? { disallowedTools: 'Write, Edit' } : {}),
    model: 'inherit',
    name,
    skills: [...GLOBAL_RULES_PRELOAD, `maestria:${name}`],
  },
  output: `../agents/claude-code/${name}.md`,
  source: CLAUDE_WRAPPER,
});

export default {
  files: {
    'adventurer.md': profile(
      'adventurer',
      'Codebase reconnaissance agent for mapping unfamiliar code, tracing call chains, and reporting verified context without implementing changes.',
      true,
    ),
    'architect.md': profile(
      'architect',
      'Architecture decision agent for comparing implementation approaches, boundaries, threat models, and ADR decisions.',
    ),
    'builder.md': profile(
      'builder',
      'Focused implementation agent for one atomic, verifiable feature, fix, test, or refactor.',
    ),
    'diagnose.md': profile(
      'diagnose',
      'Systematic regression-tracing agent from symptom and error evidence to root cause, fix, and prevention.',
    ),
    'planner.md': profile(
      'planner',
      'Phased planning agent with dependencies, verification criteria, timelines, and rollback points.',
      true,
    ),
    'reviewer.md': profile(
      'reviewer',
      'Independent review agent covering correctness, security, performance, maintainability, and quality gates.',
      true,
    ),
    'writer.md': profile(
      'writer',
      'Structured documentation agent for READMEs, API docs, architecture documents, changelogs, and decision records.',
    ),
  },
  source: './sources',
} satisfies SyncConfig;
