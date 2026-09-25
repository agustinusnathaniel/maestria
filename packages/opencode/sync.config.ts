// packages/opencode/sync.config.ts
// Sync config: derives opencode agent files from canonical core directives
//
// oxlint-disable sort-keys -- Permission maps keep their declared glob order because the sync
// engine projects object keys verbatim into generated agent frontmatter, and `check-sync`
// enforces byte identity of that committed output. Sorting keys here would churn every
// generated permission block without changing behavior.

import type { SyncConfig } from '../core/scripts/lib/config.js';

type BashPermissionEntry = readonly [string, 'allow' | 'ask' | 'deny'];

// Read-only bash projection, split so the builder's mid-sequence `du*`
// insertion names its anchor instead of slicing by magic index.
const BASE_READ_HEAD: readonly BashPermissionEntry[] = [
  ['ls*', 'allow'],
  ['cat*', 'allow'],
  ['echo*', 'allow'],
  ['head*', 'allow'],
  ['tail*', 'allow'],
  ['grep*', 'allow'],
  ['rg*', 'allow'],
  ['wc*', 'allow'],
  ['which*', 'allow'],
  ['diff*', 'allow'],
  ['stat*', 'allow'],
];

const BASE_READ_TAIL: readonly BashPermissionEntry[] = [
  ['pwd*', 'allow'],
  ['cd*', 'allow'],
  ['printf*', 'allow'],
];

const BASE_READ: readonly BashPermissionEntry[] = [...BASE_READ_HEAD, ...BASE_READ_TAIL];

const bashPermissions = (
  extraBefore: readonly BashPermissionEntry[] = [],
  extraAfter: readonly BashPermissionEntry[] = [],
): Record<string, 'allow' | 'ask' | 'deny'> =>
  Object.fromEntries([...extraBefore, ...BASE_READ, ...extraAfter]);

const allow = (...patterns: readonly string[]): BashPermissionEntry[] =>
  patterns.map((pattern): BashPermissionEntry => [pattern, 'allow']);

// Guarded recon prefix: byte-identical to REQUIRED_GIT_GLOBAL_ARGS enforced
// by bash-policy.ts (packages/shared/pi/src/bash-policy.ts). Only commands
// starting with this literal prefix auto-allow; bare `git status` and every
// other unguarded form falls through to `* ask`. Diff-capable diff/log/show
// additionally require the `--no-ext-diff --no-textconv` patch guards in
// that order (a bare guarded `diff` could execute repo-configured external
// drivers), and branch keeps `--list` discipline. These globs are coarse
// host configuration (ADR-OC-001): token-level guarantees such as custom
// --format/%G rejection and chaining/substitution denial stay in the shared
// Pi/OMP parser. `find` is intentionally not restored: the policy denies
// every find form, and a prefix glob cannot exclude -exec/-delete/-ok.
const GUARDED_GIT =
  'git --no-pager --no-optional-locks -c core.fsmonitor=false -c core.hooksPath=/dev/null -c log.showSignature=false -c format.pretty=medium';

const guardedReconGit = (): BashPermissionEntry[] =>
  allow(
    `${GUARDED_GIT} status*`,
    `${GUARDED_GIT} diff --no-ext-diff --no-textconv*`,
    `${GUARDED_GIT} log --no-ext-diff --no-textconv*`,
    `${GUARDED_GIT} show --no-ext-diff --no-textconv*`,
    `${GUARDED_GIT} branch --list*`,
    `${GUARDED_GIT} branch --show-current*`,
  );

export default {
  files: {
    'adventurer.md': {
      frontmatter: {
        description: `Codebase reconnaissance agent for mapping unfamiliar code, tracing call chains, and reporting verified context without implementing changes.`,
        mode: 'subagent',
        permission: {
          bash: bashPermissions(
            [['*', 'ask']],
            [
              ...allow('git status*', 'git rev-parse*', 'opensrc*', 'agent-browser*', 'rtk*'),
              ...guardedReconGit(),
            ],
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
        description: `Architecture decision agent for comparing implementation approaches, boundaries, threat models, and ADR decisions.`,
        mode: 'subagent',
        permission: {
          bash: bashPermissions(
            [['*', 'ask']],
            [...allow('git status*', 'opensrc*', 'npm view *'), ...guardedReconGit()],
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
        description: `Focused implementation agent for one atomic, verifiable feature, fix, test, or refactor.`,
        mode: 'subagent',
        permission: {
          // du* follows stat* in the established projection.
          bash: Object.fromEntries([
            ...BASE_READ_HEAD,
            ['du*', 'allow'],
            ...BASE_READ_TAIL,
            ...allow('test*', 'sort*', 'git*'),
            ['pnpx*', 'ask'],
            ...allow('tsc*', 'vitest*', 'vp*', 'rtk*', 'eslint*', 'prettier*'),
            ['*', 'ask'],
          ]),
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
        description: `Systematic regression-tracing agent from symptom and error evidence to root cause, fix, and prevention.`,
        mode: 'subagent',
        permission: {
          bash: bashPermissions(
            [],
            [
              ...allow('git status*', 'git blame*'),
              ['env', 'allow'],
              ['pwd', 'allow'],
              ['*', 'ask'],
            ],
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
        description: `Maestria workflow dispatcher for routing work, preserving handoffs, and keeping independent review explicit.`,
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
    'planner.md': {
      frontmatter: {
        description: `Phased planning agent with dependencies, verification criteria, timelines, and rollback points.`,
        mode: 'subagent',
        permission: {
          bash: bashPermissions(
            [['*', 'ask']],
            [...allow('git status*', 'git rev-parse*', 'mkdir*'), ...guardedReconGit()],
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
        description: `Independent review agent covering correctness, security, performance, maintainability, and quality gates.`,
        mode: 'subagent',
        permission: {
          bash: bashPermissions(
            [['*', 'ask']],
            [
              ...allow('git status*', 'git rev-parse*', 'vp*', 'rtk*', 'node*'),
              ...guardedReconGit(),
            ],
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
    },
    'writer.md': {
      frontmatter: {
        description: `Structured documentation agent for READMEs, API docs, architecture documents, changelogs, and decision records.`,
        mode: 'subagent',
        permission: {
          bash: bashPermissions(
            [['*', 'ask']],
            [
              ...allow('git status*', 'git rev-parse*', 'npm view *', 'vp*', 'mkdir*'),
              ...guardedReconGit(),
            ],
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
