// packages/opencode/sync.config.ts
// Sync config: derives opencode agent files from canonical core directives

import type { SyncConfig } from '../core/scripts/lib/config.js';

const withLegacyKeyOrder = (
  value: Record<string, unknown>,
  legacyKeys: readonly string[],
): Record<string, unknown> => {
  const ordered: Record<string, unknown> = {};
  const seen = new Set<string>();

  for (const key of legacyKeys) {
    if (key in value) {
      ordered[key] = value[key];
      seen.add(key);
    }
  }
  for (const [key, entry] of Object.entries(value)) {
    if (!seen.has(key)) {
      ordered[key] = entry;
    }
  }
  return ordered;
};

const LEGACY_READ_ONLY_KEYS = [
  'ls*',
  'cat*',
  'echo*',
  'head*',
  'tail*',
  'grep*',
  'rg*',
  'wc*',
  'which*',
  'diff*',
  'stat*',
  'pwd*',
  'cd*',
  'find*',
  'printf*',
];

const splitKeys = (value: string): string[] => (value.length === 0 ? [] : value.split(','));

const withReadOnlyKeys = (prefix: string, suffix: string): string[] => [
  ...splitKeys(prefix),
  ...LEGACY_READ_ONLY_KEYS,
  ...splitKeys(suffix),
];

const LEGACY_ADVENTURER_KEYS = withReadOnlyKeys(
  '*',
  'git log*,git diff*,git status*,git show*,git branch*,git rev-parse*,git remote*,git stash*,git config*,pnpm*,npm*,opensrc*,agent-browser*,rtk*',
);
const LEGACY_ARCHITECT_KEYS = withReadOnlyKeys(
  '*',
  'git diff*,git log*,git status*,git show*,git branch*,opensrc*,pnpm*,npm*,npm view *',
);
const LEGACY_BUILDER_KEYS = [
  ...LEGACY_READ_ONLY_KEYS.slice(0, 11),
  'du*',
  ...LEGACY_READ_ONLY_KEYS.slice(11),
  ...splitKeys('test*,sort*,git*,pnpm*,npm*,pnpx*,tsc*,vitest*,vp*,rtk*,eslint*,prettier*'),
];
const LEGACY_DIAGNOSE_KEYS = withReadOnlyKeys(
  '',
  'git status*,git diff*,git log*,git blame*,git show*,env,pwd',
);
const LEGACY_PLANNER_KEYS = withReadOnlyKeys(
  '*',
  'git status*,git diff*,git log*,git show*,git branch*,git rev-parse*,mkdir*,pnpm*,npm*',
);
const LEGACY_REVIEWER_KEYS = withReadOnlyKeys(
  '*',
  'git status*,git diff*,git log*,git show*,git branch*,git rev-parse*,pnpm*,npm*,vp*,rtk*,node*',
);
const LEGACY_WRITER_KEYS = withReadOnlyKeys(
  '*',
  'git status*,git diff*,git log*,git show*,git branch*,git rev-parse*,pnpm*,npm*,npm view *,vp*,mkdir*',
);

export default {
  files: {
    'adventurer.md': {
      frontmatter: {
        description: `Codebase reconnaissance agent for deep code understanding.
Maps unknown territory - traces call chains, maps module relationships,
generates structured reports for downstream specialists.
Use for: understanding unfamiliar code, tracing dependencies, gathering
context before implementation, investigating module structures.
One role per session: exploration only - never implement or design.`,
        mode: 'subagent',
        permission: {
          bash: withLegacyKeyOrder(
            {
              '*': 'ask',
              'agent-browser*': 'allow',
              'cat*': 'allow',
              'cd*': 'allow',
              'diff*': 'allow',
              'echo*': 'allow',
              'find*': 'allow',
              'git branch*': 'allow',
              'git config*': 'allow',
              'git diff*': 'allow',
              'git log*': 'allow',
              'git remote*': 'allow',
              'git rev-parse*': 'allow',
              'git show*': 'allow',
              'git stash*': 'allow',
              'git status*': 'allow',
              'grep*': 'allow',
              'head*': 'allow',
              'ls*': 'allow',
              'npm*': 'allow',
              'opensrc*': 'allow',
              'pnpm*': 'allow',
              'printf*': 'allow',
              'pwd*': 'allow',
              'rg*': 'allow',
              'rtk*': 'allow',
              'stat*': 'allow',
              'tail*': 'allow',
              'wc*': 'allow',
              'which*': 'allow',
            },
            LEGACY_ADVENTURER_KEYS,
          ),
          edit: 'deny',
          glob: 'allow',
          grep: 'allow',
          lsp: 'allow',
          read: 'allow',
          skill: 'allow',
          todowrite: 'allow',
          webfetch: 'allow',
          websearch: 'ask',
        },
      },
    },
    'architect.md': {
      frontmatter: {
        description: `Architecture decisions using decision matrices and ADRs.
Evaluates options with weighted criteria, clarifies business context first.
Use for: technology choices, implementation approaches, trade-off analysis.`,
        mode: 'subagent',
        permission: {
          bash: withLegacyKeyOrder(
            {
              '*': 'ask',
              'cat*': 'allow',
              'cd*': 'allow',
              'diff*': 'allow',
              'echo*': 'allow',
              'find*': 'allow',
              'git branch*': 'allow',
              'git diff*': 'allow',
              'git log*': 'allow',
              'git show*': 'allow',
              'git status*': 'allow',
              'grep*': 'allow',
              'head*': 'allow',
              'ls*': 'allow',
              'npm view *': 'allow',
              'npm*': 'allow',
              'opensrc*': 'allow',
              'pnpm*': 'allow',
              'printf*': 'allow',
              'pwd*': 'allow',
              'rg*': 'allow',
              'stat*': 'allow',
              'tail*': 'allow',
              'wc*': 'allow',
              'which*': 'allow',
            },
            LEGACY_ARCHITECT_KEYS,
          ),
          edit: 'deny',
          glob: 'allow',
          grep: 'allow',
          lsp: 'allow',
          read: 'allow',
          skill: 'allow',
          webfetch: 'allow',
          websearch: 'ask',
        },
      },
    },
    'builder.md': {
      frontmatter: {
        description: `Focused implementation agent for atomic tasks.
Executes one verifiable unit of work with minimal context.
Use for: targeted fixes, feature implementation, refactors, adding tests.`,
        mode: 'subagent',
        permission: {
          bash: withLegacyKeyOrder(
            {
              // Read-only file operations (Claude Code baseline)
              '*': 'ask',
              'cat*': 'allow',
              'cd*': 'allow',
              'diff*': 'allow',
              'du*': 'allow',
              'echo*': 'allow',
              'eslint*': 'allow',
              'find*': 'allow',
              'git*': 'allow',
              'grep*': 'allow',
              'head*': 'allow',
              'ls*': 'allow',
              'npm*': 'allow',
              'pnpm*': 'allow',
              'pnpx*': 'ask',
              'prettier*': 'allow',
              'printf*': 'allow',
              'pwd*': 'allow',
              'rg*': 'allow',
              'rtk*': 'allow',
              'sort*': 'allow',
              'stat*': 'allow',
              'tail*': 'allow',
              'test*': 'allow',
              'tsc*': 'allow',
              'vitest*': 'allow',
              'vp*': 'allow',
              'wc*': 'allow',
              'which*': 'allow',
            },
            LEGACY_BUILDER_KEYS,
          ),
          edit: 'allow',
          glob: 'allow',
          grep: 'allow',
          lsp: 'allow',
          read: 'allow',
          skill: 'allow',
          todowrite: 'allow',
          webfetch: 'allow',
        },
      },
    },
    'commands/blitz.md': {
      output: 'commands/blitz.md',
      stripFrontmatter: true,
    },
    'commands/fein.md': {
      output: 'commands/fein.md',
      stripFrontmatter: true,
    },
    'commands/sonar.md': {
      output: 'commands/sonar.md',
      stripFrontmatter: true,
    },
    'diagnose.md': {
      frontmatter: {
        description: `Systematic 6-step regression tracing.
From error message to root cause to prevention.
Use for: cryptic errors, regressions, production bugs.`,
        mode: 'subagent',
        permission: {
          bash: withLegacyKeyOrder(
            {
              // Read-only file operations
              '*': 'ask',
              'cat*': 'allow',
              'cd*': 'allow',
              'diff*': 'allow',
              'echo*': 'allow',
              env: 'allow',
              'find*': 'allow',
              'git blame*': 'allow',
              'git diff*': 'allow',
              'git log*': 'allow',
              'git show*': 'allow',
              'git status*': 'allow',
              'grep*': 'allow',
              'head*': 'allow',
              'ls*': 'allow',
              'printf*': 'allow',
              pwd: 'allow',
              'pwd*': 'allow',
              'rg*': 'allow',
              'stat*': 'allow',
              'tail*': 'allow',
              'wc*': 'allow',
              'which*': 'allow',
              // Catch-all - unusual/dangerous commands still ask
            },
            LEGACY_DIAGNOSE_KEYS,
          ),
          edit: 'allow',
          glob: 'allow',
          grep: 'allow',
          lsp: 'allow',
          read: 'allow',
          skill: 'allow',
          todowrite: 'allow',
          webfetch: 'allow',
          websearch: 'ask',
        },
      },
    },
    'orchestrator.md': {
      frontmatter: {
        description: `Manager agent for complex multi-step tasks.
Breaks down work, delegates to specialists, integrates results.
Use for: multi-file features, cross-domain tasks, 3+ step workflows.`,
        mode: 'all',
        permission: {
          bash: {
            '*': 'deny',
            '* npx --yes skills@latest *': 'allow',
          },
          edit: 'deny',
          glob: 'deny',
          grep: 'deny',
          lsp: 'deny',
          question: 'allow',
          read: 'deny',
          skill: 'allow',
          task: {
            '*': 'deny',
            adventurer: 'allow',
            architect: 'allow',
            builder: 'allow',
            diagnose: 'allow',
            planner: 'allow',
            reviewer: 'allow',
            writer: 'allow',
          },
          todowrite: 'allow',
          webfetch: 'deny',
        },
      },
    },
    // NOTE: no body `replace` ops for orchestrator.md. The previous seven
    // body replaces anchored to canonical sentences removed in earlier
    // directive revisions and silently no-op'd (split/join never matches);
    // the canonical orchestrator body is already platform-neutral.
    'planner.md': {
      frontmatter: {
        description: `Create detailed implementation plans with phased dependencies, timelines, and success criteria.
Breaks down complex features into verifiable milestones.
Use for: complex features requiring multi-phase execution, when the plan needs review before building.`,
        mode: 'subagent',
        permission: {
          bash: withLegacyKeyOrder(
            {
              '*': 'ask',
              // Read-only file operations
              'cat*': 'allow',
              'cd*': 'allow',
              'diff*': 'allow',
              'echo*': 'allow',
              'find*': 'allow',
              // Git operations
              'git branch*': 'allow',
              'git diff*': 'allow',
              'git log*': 'allow',
              'git rev-parse*': 'allow',
              'git show*': 'allow',
              'git status*': 'allow',
              'grep*': 'allow',
              'head*': 'allow',
              'ls*': 'allow',
              'mkdir*': 'allow',
              // Package managers
              'npm*': 'allow',
              'pnpm*': 'allow',
              'printf*': 'allow',
              'pwd*': 'allow',
              'rg*': 'allow',
              'stat*': 'allow',
              'tail*': 'allow',
              'wc*': 'allow',
              'which*': 'allow',
            },
            LEGACY_PLANNER_KEYS,
          ),
          edit: 'ask',
          glob: 'allow',
          grep: 'allow',
          lsp: 'allow',
          read: 'allow',
          skill: 'allow',
          todowrite: 'allow',
          webfetch: 'allow',
        },
      },
    },
    'reviewer.md': {
      frontmatter: {
        description: `Code review with quality gates.
Reviews code for correctness, edge cases, security, performance, maintainability,
and adherence to conventions. Provides specific, actionable feedback.
Use for: PR review, pre-commit review, architecture document review.`,
        mode: 'subagent',
        permission: {
          bash: withLegacyKeyOrder(
            {
              '*': 'ask',
              // Read-only file operations
              'cat*': 'allow',
              'cd*': 'allow',
              'diff*': 'allow',
              'echo*': 'allow',
              'find*': 'allow',
              // Git operations
              'git branch*': 'allow',
              'git diff*': 'allow',
              'git log*': 'allow',
              'git rev-parse*': 'allow',
              'git show*': 'allow',
              'git status*': 'allow',
              'grep*': 'allow',
              'head*': 'allow',
              'ls*': 'allow',
              'node*': 'allow',
              // Package managers
              'npm*': 'allow',
              'pnpm*': 'allow',
              'printf*': 'allow',
              'pwd*': 'allow',
              'rg*': 'allow',
              // Build, test, lint tools
              'rtk*': 'allow',
              'stat*': 'allow',
              'tail*': 'allow',
              'vp*': 'allow',
              'wc*': 'allow',
              'which*': 'allow',
            },
            LEGACY_REVIEWER_KEYS,
          ),
          edit: 'deny',
          glob: 'allow',
          grep: 'allow',
          lsp: 'allow',
          read: 'allow',
          skill: 'allow',
          webfetch: 'allow',
        },
      },
    },
    'rules.md': {
      output: '../rules/AGENTS.md',
      // NOTE: no replace ops. The previous generic-vocabulary renames
      // ("repo cloning tool", "URL fetch", "web search", ...) anchored to
      // canonical sentences that no longer exist; the canonical rules body
      // is already tool-neutral.
    },
    'writer.md': {
      frontmatter: {
        description: `Documentation writing following structured patterns.
Creates clear, comprehensive docs for code, APIs, systems.
Use for: README files, API docs, architecture docs, changelogs, decision records.`,
        mode: 'subagent',
        permission: {
          bash: withLegacyKeyOrder(
            {
              '*': 'ask',
              // Read-only file operations
              'cat*': 'allow',
              'cd*': 'allow',
              'diff*': 'allow',
              'echo*': 'allow',
              'find*': 'allow',
              // Git operations
              'git branch*': 'allow',
              'git diff*': 'allow',
              'git log*': 'allow',
              'git rev-parse*': 'allow',
              'git show*': 'allow',
              'git status*': 'allow',
              'grep*': 'allow',
              'head*': 'allow',
              'ls*': 'allow',
              'mkdir*': 'allow',
              // Package managers
              'npm view *': 'allow',
              'npm*': 'allow',
              'pnpm*': 'allow',
              'printf*': 'allow',
              'pwd*': 'allow',
              'rg*': 'allow',
              // Build, test, lint tools
              'stat*': 'allow',
              'tail*': 'allow',
              'vp*': 'allow',
              'wc*': 'allow',
              'which*': 'allow',
            },
            LEGACY_WRITER_KEYS,
          ),
          edit: 'allow',
          glob: 'allow',
          grep: 'allow',
          lsp: 'allow',
          read: 'allow',
          skill: 'allow',
          todowrite: 'allow',
          webfetch: 'allow',
        },
      },
    },
  },
  output: 'agents',
  source: '../core/agent-directives/specialists',
} satisfies SyncConfig;
