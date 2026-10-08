// packages/opencode-v2/sync.config.ts
// Sync config: derives opencode-v2 agent files from canonical core directives
//
// oxlint-disable sort-keys -- Key order here is declarative (source/output/default/files);
// `check-sync` enforces byte identity of the generated agent frontmatter, so keys stay
// in logical order instead of sorted order.

import type { SyncConfig } from '../core/scripts/lib/config.js';

// 7 specialists (mode: subagent) synced from canonical core directives.
// Descriptions here become the generated agents/ frontmatter.
const SPECIALIST_DESCRIPTIONS = {
  adventurer: 'Codebase reconnaissance, deep code understanding',
  architect: 'Architecture decisions, trade-off analysis, ADRs',
  builder: 'Focused implementation, single-task execution',
  diagnose: 'Systematic bug tracing, root cause analysis',
  planner: 'Implementation plans with phased milestones',
  reviewer: 'Code review with quality gates',
  writer: 'Documentation following structured patterns',
} as const;

// Per-agent permission rules (V2 `permissions` arrays). Faithful port of the
// V1 `permission` maps in packages/opencode/sync.config.ts: same rule order
// (V2 is last-match-wins, so the broad-first/exceptions-after layout keeps
// its meaning), `bash` renamed to `shell` and `task` to `subagent` per
// /permissions, scalar tool effects expanded to `resource: '*'`. All other
// action names transfer verbatim; an action the host never checks simply
// never matches.
type PermissionEffect = 'allow' | 'ask' | 'deny';

interface AgentPermissionRule {
  action: string;
  effect: PermissionEffect;
  resource: string;
}

type ShellEntry = readonly [resource: string, effect: PermissionEffect];

// Read-only shell projection, split so the builder's `du*` insertion names
// its anchor (mirrors BASE_READ_HEAD/TAIL in packages/opencode/sync.config.ts).
const BASE_READ_HEAD: readonly ShellEntry[] = [
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

const BASE_READ_TAIL: readonly ShellEntry[] = [
  ['pwd*', 'allow'],
  ['cd*', 'allow'],
  ['printf*', 'allow'],
];

const BASE_READ_SHELL: readonly ShellEntry[] = [...BASE_READ_HEAD, ...BASE_READ_TAIL];

const toShellRules = (entries: readonly ShellEntry[]): AgentPermissionRule[] =>
  entries.map(([resource, effect]) => ({ action: 'shell', effect, resource }));

const shellRules = (
  before: readonly ShellEntry[] = [],
  after: readonly ShellEntry[] = [],
): AgentPermissionRule[] => toShellRules([...before, ...BASE_READ_SHELL, ...after]);

const allow = (...patterns: readonly string[]): ShellEntry[] =>
  patterns.map((pattern): ShellEntry => [pattern, 'allow']);

const toolRule = (action: string, effect: PermissionEffect): AgentPermissionRule => ({
  action,
  effect,
  resource: '*',
});

const allowTools = (...actions: readonly string[]): AgentPermissionRule[] =>
  actions.map((action) => toolRule(action, 'allow'));

// Guarded recon prefix: byte-identical to REQUIRED_GIT_GLOBAL_ARGS enforced
// by bash-policy.ts (packages/shared/pi/src/bash-policy.ts) and to the copy
// in packages/opencode/sync.config.ts. Only commands starting with this
// literal prefix auto-allow; every other form falls through to `* ask`.
const GUARDED_GIT =
  'git --no-pager --no-optional-locks -c core.fsmonitor=false -c core.hooksPath=/dev/null -c log.showSignature=false -c format.pretty=medium';

const guardedReconGit = (): ShellEntry[] =>
  allow(
    `${GUARDED_GIT} status*`,
    `${GUARDED_GIT} diff --no-ext-diff --no-textconv*`,
    `${GUARDED_GIT} log --no-ext-diff --no-textconv*`,
    `${GUARDED_GIT} show --no-ext-diff --no-textconv*`,
    `${GUARDED_GIT} branch --list*`,
    `${GUARDED_GIT} branch --show-current*`,
  );

// Keyed by specialist name; deliberately Record<string, ...> so the lookup
// below needs no narrowing assertion. A misspelled key leaves its agent
// without a block, which the loader tests (non-empty permissions per agent)
// catch loudly.
const SPECIALIST_PERMISSIONS: Record<string, AgentPermissionRule[]> = {
  adventurer: [
    ...shellRules(
      [['*', 'ask']],
      [
        ...allow('git status*', 'git rev-parse*', 'opensrc*', 'agent-browser*', 'rtk*'),
        ...guardedReconGit(),
      ],
    ),
    toolRule('edit', 'deny'),
    ...allowTools('glob', 'grep', 'lsp', 'read', 'skill', 'todowrite', 'webfetch'),
    toolRule('websearch', 'ask'),
  ],
  architect: [
    ...shellRules(
      [['*', 'ask']],
      [...allow('git status*', 'opensrc*', 'npm view *'), ...guardedReconGit()],
    ),
    toolRule('edit', 'deny'),
    ...allowTools('glob', 'grep', 'lsp', 'read', 'skill', 'webfetch'),
    toolRule('websearch', 'ask'),
  ],
  builder: [
    // du* follows stat* in the established projection.
    ...toShellRules([
      ...BASE_READ_HEAD,
      ['du*', 'allow'],
      ...BASE_READ_TAIL,
      ...allow('test*', 'sort*', 'git*'),
      ['pnpx*', 'ask'],
      ...allow('tsc*', 'vitest*', 'vp*', 'rtk*', 'eslint*', 'prettier*'),
      ['*', 'ask'],
    ]),
    ...allowTools('edit', 'glob', 'grep', 'lsp', 'read', 'skill', 'todowrite', 'webfetch'),
  ],
  diagnose: [
    ...shellRules(
      [],
      [...allow('git status*', 'git blame*'), ['env', 'allow'], ['pwd', 'allow'], ['*', 'ask']],
    ),
    toolRule('edit', 'allow'),
    ...allowTools('glob', 'grep', 'lsp', 'read', 'skill', 'todowrite', 'webfetch'),
    toolRule('websearch', 'ask'),
  ],
  planner: [
    ...shellRules(
      [['*', 'ask']],
      [...allow('git status*', 'git rev-parse*', 'mkdir*'), ...guardedReconGit()],
    ),
    toolRule('edit', 'ask'),
    ...allowTools('glob', 'grep', 'lsp', 'read', 'skill', 'todowrite', 'webfetch'),
  ],
  reviewer: [
    ...shellRules(
      [['*', 'ask']],
      [...allow('git status*', 'git rev-parse*', 'vp*', 'rtk*', 'node*'), ...guardedReconGit()],
    ),
    toolRule('edit', 'deny'),
    ...allowTools('glob', 'grep', 'lsp', 'read', 'skill', 'webfetch'),
  ],
  writer: [
    ...shellRules(
      [['*', 'ask']],
      [
        ...allow('git status*', 'git rev-parse*', 'npm view *', 'vp*', 'mkdir*'),
        ...guardedReconGit(),
      ],
    ),
    toolRule('edit', 'allow'),
    ...allowTools('glob', 'grep', 'lsp', 'read', 'skill', 'todowrite', 'webfetch'),
  ],
};

const specialistEntries = Object.fromEntries(
  Object.entries(SPECIALIST_DESCRIPTIONS).map(([name, description]) => [
    `${name}.md`,
    {
      frontmatter: {
        description,
        mode: 'subagent',
        permissions: SPECIALIST_PERMISSIONS[name],
      },
    },
  ]),
);

// 3 workflow commands from ../core/agent-directives/commands/.
// Resolved via secondary source loop (dirname(source) = ../core/agent-directives/)
const commandEntries = Object.fromEntries(
  (['fein', 'sonar', 'blitz'] as const).map((name) => [
    `commands/${name}.md`,
    { output: `commands/${name}.md`, stripFrontmatter: true },
  ]),
);

// Core skills from ../core/agent-directives/skills/. Same secondary-source
// resolution as rules (outputs resolve under the agents base, hence the
// ../skills/ prefix). Frontmatter is KEPT: stripFrontmatter false overrides
// the package default, so synced copies stay complete skill files whose block
// the loader parses at runtime (see src/transforms/skills.ts). Bundled so
// the published package carries its skills instead of reaching outside
// itself at runtime.
const skillEntries = Object.fromEntries(
  (['handoff', 'iteration-limits'] as const).map((name) => [
    `skills/${name}.md`,
    { output: `../skills/${name}.md`, stripFrontmatter: false },
  ]),
);

export default {
  source: '../core/agent-directives/specialists',
  output: 'agents',

  default: {
    stripFrontmatter: true,
    replace: [],
  },

  files: {
    // Orchestrator - mode: all (the router). Locked down like V1: no
    // direct tools, delegates only through the subagent allowlist.
    'orchestrator.md': {
      frontmatter: {
        description:
          'Routes each turn to direct, focused, or full execution; delegates to specialists; manages commit protocol',
        mode: 'all',
        permissions: [
          { action: 'shell', effect: 'deny', resource: '*' },
          { action: 'shell', effect: 'allow', resource: '* npx --yes skills@latest *' },
          toolRule('edit', 'deny'),
          toolRule('glob', 'deny'),
          toolRule('grep', 'deny'),
          toolRule('lsp', 'deny'),
          toolRule('question', 'allow'),
          toolRule('read', 'deny'),
          toolRule('skill', 'allow'),
          { action: 'subagent', effect: 'deny', resource: '*' },
          { action: 'subagent', effect: 'allow', resource: 'adventurer' },
          { action: 'subagent', effect: 'allow', resource: 'architect' },
          { action: 'subagent', effect: 'allow', resource: 'builder' },
          { action: 'subagent', effect: 'allow', resource: 'diagnose' },
          { action: 'subagent', effect: 'allow', resource: 'planner' },
          { action: 'subagent', effect: 'allow', resource: 'reviewer' },
          { action: 'subagent', effect: 'allow', resource: 'writer' },
          toolRule('todowrite', 'allow'),
          toolRule('webfetch', 'deny'),
        ],
      },
    },
    ...specialistEntries,
    ...commandEntries,
    ...skillEntries,

    // Global rules from ../core/agent-directives/rules.md
    // Resolved via secondary source loop
    'rules.md': {
      output: '../rules/AGENTS.md',
      stripFrontmatter: true,
    },
  },

  preserve: ['.gitkeep'],
} satisfies SyncConfig;
