import type { SyncConfig } from '../../../core/scripts/lib/config.js';

export default {
  default: {
    replace: [
      {
        from: '@adventurer',
        to: 'adventurer',
      },
      {
        from: '@architect',
        to: 'architect',
      },
      {
        from: '@builder',
        to: 'builder',
      },
      {
        from: '@diagnose',
        to: 'diagnose',
      },
      {
        from: '@planner',
        to: 'planner',
      },
      {
        from: '@reviewer',
        to: 'reviewer',
      },
      {
        from: '@writer',
        to: 'writer',
      },
      {
        from: 'run in parallel',
        to: 'run in parallel via multiple `Task` calls',
      },
    ],
  },
  files: {
    'adventurer.md': {
      frontmatter: {
        description:
          'Codebase reconnaissance agent for mapping unfamiliar code, tracing call chains, and reporting verified context without implementing changes.',
        name: 'adventurer',
        readonly: true,
      },
      output: 'adventurer.md',
      prepend:
        '**Read-only.** You have Read, Glob, Grep, Shell, WebSearch, and WebFetch. Do **not** use Write, StrReplace, or Delete. Exploration only - never implement or design.\n\n',
    },
    'architect.md': {
      frontmatter: {
        description:
          'Architecture decision agent for comparing implementation approaches, boundaries, threat models, and ADR decisions.',
        name: 'architect',
      },
      output: 'architect.md',
    },
    'builder.md': {
      frontmatter: {
        description:
          'Focused implementation agent for one atomic, verifiable feature, fix, test, or refactor.',
        name: 'builder',
      },
      output: 'builder.md',
    },
    'commands/blitz.md': {
      append: '',
      output: '../../integrations/cursor/commands/blitz.md',
      prepend:
        '---\nname: blitz\ndescription: Fast maestria implementation via builder (skip optional recon/design unless unknown; required review remains)\n---\n',
      replace: [
        {
          from: '@@MODE@@',
          to: 'blitz',
        },
      ],
      source: '../../../core/agent-directives/aliases/workflow.md',
      stripFrontmatter: true,
    },
    'commands/fein.md': {
      append: '',
      output: '../../integrations/cursor/commands/fein.md',
      prepend:
        '---\nname: fein\ndescription: Run the full maestria pipeline (recon -> design -> implement -> review)\n---\n',
      replace: [
        {
          from: '@@MODE@@',
          to: 'fein',
        },
      ],
      source: '../../../core/agent-directives/aliases/workflow.md',
      stripFrontmatter: true,
    },
    'commands/sonar.md': {
      append: '',
      output: '../../integrations/cursor/commands/sonar.md',
      prepend:
        '---\nname: sonar\ndescription: Research-only maestria mode (recon -> design, no implementation)\n---\n',
      replace: [
        {
          from: '@@MODE@@',
          to: 'sonar',
        },
      ],
      source: '../../../core/agent-directives/aliases/workflow.md',
      stripFrontmatter: true,
    },
    'diagnose.md': {
      frontmatter: {
        description:
          'Systematic regression-tracing agent from symptom and error evidence to root cause, fix, and prevention.',
        name: 'diagnose',
      },
      output: 'diagnose.md',
    },
    'orchestrator.md': {
      output: '../../integrations/cursor/context.md',
      source: '../../../core/agent-directives/integrations/cursor.md',
    },
    'planner.md': {
      frontmatter: {
        description:
          'Phased planning agent with dependencies, verification criteria, timelines, and rollback points.',
        name: 'planner',
        readonly: true,
      },
      output: 'planner.md',
      prepend:
        '**Plan only.** Prefer Read, Glob, Grep, Shell (read-only), WebSearch, WebFetch. Do **not** implement or edit production code - produce a structured plan.\n\n',
    },
    'reviewer.md': {
      frontmatter: {
        description:
          'Independent review agent covering correctness, security, performance, maintainability, and quality gates.',
        name: 'reviewer',
        readonly: true,
      },
      output: 'reviewer.md',
      prepend:
        '**Checker only - maker/checker split.** Produce a structured review report. Do **not** use Write, StrReplace, or Delete. Do not fix issues yourself; report them for builder.\n\n',
    },
    'rules.md': {
      frontmatter: {
        alwaysApply: true,
        description:
          'maestria global agent rules - always apply for Cursor sessions using the maestria plugin',
      },
      output: '../../integrations/cursor/rules/maestria-global.mdc',
      replace: [
        {
          from: '# Global Agent Rules',
          to: '# Global Agent Rules - maestria for Cursor',
        },
        {
          from: '## Delegation and Context\n',
          to: '## Delegation and Context\n\nDelegate only to the seven specialists: adventurer, architect, builder, diagnose, planner, reviewer, writer.\n',
        },
      ],
    },
    'writer.md': {
      frontmatter: {
        description:
          'Structured documentation agent for READMEs, API docs, architecture documents, changelogs, and decision records.',
        name: 'writer',
      },
      output: 'writer.md',
    },
  },
  output: '../../agents/cursor',
  preserve: ['.gitkeep'],
  source: '../../../core/agent-directives/specialists',
} satisfies SyncConfig;
