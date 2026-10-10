import { specialistReferenceReplacements } from '../../core/scripts/lib/specialist-replacements.js';
import type { FileConfig, SyncConfig } from '../../core/scripts/lib/config.js';

const readonlyNotes: Record<string, string> = {
  adventurer:
    '**Read-only role (advisory):** Agent Skills do not grant or deny host tools. Explore, trace, map, and report; never implement, design, or edit while following this role.\n\n',
  planner:
    '**Read-only role (advisory):** Agent Skills do not grant or deny host tools. Produce a structured plan with phases, verification, and rollback points; do not edit files while following this role.\n\n',
  reviewer:
    '**Read-only role (advisory):** Agent Skills do not grant or deny host tools. Review and report findings; do not fix issues yourself while following this role.\n\n',
};

const role = (name: string, description: string): FileConfig => ({
  frontmatter: { description, name },
  output: `${name}.md`,
  ...(readonlyNotes[name] === undefined ? {} : { prepend: readonlyNotes[name] }),
});

export default {
  default: { replace: specialistReferenceReplacements() },
  files: {
    'adventurer.md': role(
      'adventurer',
      'Codebase reconnaissance agent for mapping unfamiliar code, tracing call chains, and reporting verified context without implementing changes.',
    ),
    'architect.md': role(
      'architect',
      'Architecture decision agent for comparing implementation approaches, boundaries, threat models, and ADR decisions.',
    ),
    'builder.md': role(
      'builder',
      'Focused implementation agent for one atomic, verifiable feature, fix, test, or refactor.',
    ),
    'diagnose.md': role(
      'diagnose',
      'Systematic regression-tracing agent from symptom and error evidence to root cause, fix, and prevention.',
    ),
    'orchestrator.md': role(
      'orchestrator',
      'maestria workflow dispatcher for routing work, preserving handoffs, and keeping independent review explicit.',
    ),
    'planner.md': role(
      'planner',
      'Phased planning agent with dependencies, verification criteria, timelines, and rollback points.',
    ),
    'reviewer.md': role(
      'reviewer',
      'Independent review agent covering correctness, security, performance, maintainability, and quality gates.',
    ),
    'writer.md': role(
      'writer',
      'Structured documentation agent for READMEs, API docs, architecture documents, changelogs, and decision records.',
    ),
  },
  output: '../agents',
  source: '../../core/agent-directives/specialists',
} satisfies SyncConfig;
