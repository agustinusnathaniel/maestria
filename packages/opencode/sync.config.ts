// packages/opencode/sync.config.ts
// Sync config: derives OpenCode agent, command, and rules files from canonical core directives
//
// oxlint-disable sort-keys -- Permission maps keep their declared glob order because the sync
// engine projects them in order into generated agent frontmatter, and `check-sync` enforces byte
// identity of that committed output. Sorting keys here would churn every generated permission
// block without changing behavior.
//
// OpenCode takes ordered `permissions` rules (last match wins). Each map below translates entry by
// entry in declaration order, so its effective policy is preserved: `bash` and `task` become the
// `shell` and `subagent` actions, and a scalar effect applies to resource `*`. Commands keep their
// canonical frontmatter, whose description the plugin registers with each slash command.

import type { FileConfig, SyncConfig } from '../core/scripts/lib/config.js';

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
// Pi parser. `find` is intentionally not restored: the policy denies
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

// Authored as OpenCode V1 `permission` maps, which read compactly; translated to V2 rules below.
// du* follows stat* in the established projection. Shared by every agent that writes changes.
const WRITER_BASH: readonly BashPermissionEntry[] = [
  ...BASE_READ_HEAD,
  ['du*', 'allow'],
  ...BASE_READ_TAIL,
  ...allow('test*', 'sort*', 'git*'),
  ['pnpx*', 'ask'],
  ...allow('tsc*', 'vitest*', 'vp*', 'rtk*', 'eslint*', 'prettier*'),
  ['*', 'ask'],
];

const permissionMaps = {
  files: {
    'adventurer.md': {
      frontmatter: {
        description: `Codebase reconnaissance agent for mapping unfamiliar code, tracing call chains and root causes, and reporting verified context without implementing changes.`,
        mode: 'subagent',
        permission: {
          bash: bashPermissions(
            [['*', 'ask']],
            [
              ...allow(
                'git status*',
                'git rev-parse*',
                'git blame*',
                'opensrc*',
                'agent-browser*',
                'rtk*',
              ),
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
        description: `Architecture decision and planning agent for comparing implementation approaches, boundaries, threat models, ADR decisions, and phased plans.`,
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
        description: `Focused implementation agent for one atomic, verifiable feature, fix, test, refactor, or documentation change.`,
        mode: 'subagent',
        permission: {
          bash: Object.fromEntries(WRITER_BASH),
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
      source: '../core/agent-directives/opencode/commands/blitz.md',
      stripFrontmatter: true,
    },
    'commands/fein.md': {
      output: 'commands/fein.md',
      source: '../core/agent-directives/opencode/commands/fein.md',
      stripFrontmatter: true,
    },
    'commands/sonar.md': {
      output: 'commands/sonar.md',
      source: '../core/agent-directives/opencode/commands/sonar.md',
      stripFrontmatter: true,
    },
    'orchestrator.md': {
      source: '../core/agent-directives/opencode/orchestrator.md',
      frontmatter: {
        description: `maestria main loop that investigates, designs, implements, and delivers each outcome, with one blind reviewer for meaningful changes.`,
        mode: 'all',
        permission: {
          bash: Object.fromEntries([...WRITER_BASH, ['* npx --yes skills@latest *', 'allow']]),
          edit: 'allow',
          glob: 'allow',
          grep: 'allow',
          lsp: 'allow',
          question: 'allow',
          read: 'allow',
          skill: 'allow',
          task: {
            '*': 'deny',
            reviewer: 'allow',
          },
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
    'rules-delivery.md': {
      output: '../rules/delivery.md',
      section: 'Continuation and Delivery',
      source: '../core/agent-directives/opencode/orchestrator.md',
    },
    'rules-modes.md': {
      output: '../rules/modes.md',
      section: 'Modes',
      source: '../core/agent-directives/opencode/orchestrator.md',
    },
  },
  output: 'agents',
  source: '../core/agent-directives/specialists',
} satisfies SyncConfig;

const RULE_ACTIONS: Record<string, string> = { bash: 'shell', task: 'subagent' };

type MapFile = (typeof permissionMaps.files)[keyof typeof permissionMaps.files];

const toPermissions = (permission: Record<string, string | Record<string, string>>) =>
  Object.entries(permission).flatMap(([tool, value]) => {
    const action = RULE_ACTIONS[tool] ?? tool;
    return typeof value === 'string'
      ? [{ action, effect: value, resource: '*' }]
      : Object.entries(value).map(([resource, effect]) => ({
          action,
          effect,
          resource,
        }));
  });

const toRulesConfig = (name: string, file: MapFile): FileConfig => {
  if (name.startsWith('commands/')) {
    return { ...file, stripFrontmatter: false };
  }
  if (!('frontmatter' in file)) {
    return file;
  }
  const { permission, ...rest } = file.frontmatter;
  return {
    ...file,
    frontmatter: { ...rest, permissions: toPermissions(permission) },
  };
};

export default {
  ...permissionMaps,
  files: Object.fromEntries(
    Object.entries(permissionMaps.files).map(([name, file]) => [name, toRulesConfig(name, file)]),
  ),
} satisfies SyncConfig;
