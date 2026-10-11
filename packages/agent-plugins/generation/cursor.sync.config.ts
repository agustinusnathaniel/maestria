import type { FileConfig, SyncConfig } from '../../core/scripts/lib/config.js';

const workflowSource = '../../core/agent-directives/aliases/workflow.md';
const CURSOR_MODE_DESCRIPTIONS: Record<string, string> = {
  blitz:
    'Fast maestria implementation via builder (skip optional recon/design unless unknown; required review remains)',
  fein: 'Run the full maestria pipeline (recon -> design -> implement -> review)',
  sonar: 'Research-only maestria mode (recon -> design, no implementation)',
};

const aliases = Object.fromEntries(
  ['blitz', 'fein', 'sonar'].map((mode) => [
    `cursor-${mode}.md`,
    {
      output: `../commands/cursor/${mode}.md`,
      prepend: `---\nname: ${mode}\ndescription: ${CURSOR_MODE_DESCRIPTIONS[mode]}\n---\n`,
      replace: [{ from: '@@MODE@@', to: mode }],
      source: workflowSource,
      stripFrontmatter: true,
    } satisfies FileConfig,
  ]),
);

const role = (name: string, description: string, extra: Partial<FileConfig> = {}): FileConfig => ({
  ...extra,
  frontmatter: {
    description,
    name,
    ...(name === 'adventurer' || name === 'planner' || name === 'reviewer'
      ? { readonly: true }
      : {}),
  },
  output: `../agents/cursor/${name}.md`,
  source: `../../core/agent-directives/specialists/${name}.md`,
});

export default {
  default: {
    replace: [
      { from: '@architect', to: 'architect' },
      { from: '@builder', to: 'builder' },
      { from: '@reviewer', to: 'reviewer' },
      { from: 'run in parallel', to: 'run in parallel via multiple `Task` calls' },
    ],
  },
  files: {
    'adventurer.md': role(
      'adventurer',
      'Codebase reconnaissance agent for mapping unfamiliar code, tracing call chains, and reporting verified context without implementing changes.',
      {
        prepend:
          '**Read-only.** You have Read, Glob, Grep, Shell, WebSearch, and WebFetch. Do **not** use Write, StrReplace, or Delete. Exploration only - never implement or design.\n\n',
      },
    ),
    'architect.md': role(
      'architect',
      'Architecture decision agent for comparing implementation approaches, boundaries, threat models, and ADR decisions.',
    ),
    'builder.md': role(
      'builder',
      'Focused implementation agent for one atomic, verifiable feature, fix, test, or refactor.',
    ),
    'cursor-rule.md': {
      frontmatter: {
        alwaysApply: true,
        description:
          'maestria global agent rules - always apply for Cursor sessions using the maestria plugin',
      },
      output: '../rules/cursor/maestria-global.mdc',
      replace: [
        { from: '# Global Agent Rules', to: '# Global Agent Rules - maestria for Cursor' },
        {
          from: '## Delegation and Context\n',
          to: '## Delegation and Context\n\nDelegate only to the seven specialists: adventurer, architect, builder, diagnose, planner, reviewer, writer.\n',
        },
      ],
      source: '../../core/agent-directives/rules.md',
    },
    'diagnose.md': role(
      'diagnose',
      'Systematic regression-tracing agent from symptom and error evidence to root cause, fix, and prevention.',
    ),
    'planner.md': role(
      'planner',
      'Phased planning agent with dependencies, verification criteria, timelines, and rollback points.',
      {
        prepend:
          '**Plan only.** Prefer Read, Glob, Grep, Shell (read-only), WebSearch, WebFetch. Do **not** implement or edit production code - produce a structured plan.\n\n',
      },
    ),
    'reviewer.md': role(
      'reviewer',
      'Independent review agent covering correctness, security, performance, maintainability, and quality gates.',
      {
        prepend:
          '**Checker only - maker/checker split.** Produce a structured review report. Do **not** use Write, StrReplace, or Delete. Do not fix issues yourself; report them for builder.\n\n',
      },
    ),
    'writer.md': role(
      'writer',
      'Structured documentation agent for READMEs, API docs, architecture documents, changelogs, and decision records.',
    ),
    ...aliases,
  },
  source: './sources',
} satisfies SyncConfig;
