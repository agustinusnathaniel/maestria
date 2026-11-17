// OpenCode agent frontmatter for the generated agents/*.md, composed by scripts/native-adapter-files.ts.
//
// oxlint-disable sort-keys -- Permission maps keep their declared glob order because generation
// projects them in order into agent frontmatter, and `check-sync` enforces byte identity of that
// committed output.
//
// OpenCode takes ordered `permissions` rules (last match wins). Each map below translates entry by
// entry in declaration order, so its effective policy is preserved: `bash` and `task` become the
// `shell` and `subagent` actions, and a scalar effect applies to resource `*`.

type BashPermissionEntry = readonly [string, 'allow' | 'ask' | 'deny'];

// Read-only bash projection, split so the writer set's mid-sequence `du*`
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
// by bash-policy.ts (packages/pi/src/bash-policy.ts). Only commands
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
// du* follows stat* in the established projection. Used by the maestria main agent, which writes changes.
const WRITER_BASH: readonly BashPermissionEntry[] = [
  ...BASE_READ_HEAD,
  ['du*', 'allow'],
  ...BASE_READ_TAIL,
  ...allow('test*', 'sort*', 'git*'),
  ['pnpx*', 'ask'],
  ...allow('tsc*', 'vitest*', 'vp*', 'rtk*', 'eslint*', 'prettier*'),
  ['*', 'ask'],
];

type Permission = Record<string, string | Record<string, string>>;

const RULE_ACTIONS: Record<string, string> = { bash: 'shell', task: 'subagent' };

const toPermissions = (permission: Permission) =>
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

export const opencodeAgents = {
  maestria: {
    description: `maestria main loop that investigates, designs, implements, and delivers each outcome, with one blind reviewer for meaningful changes.`,
    mode: 'all',
    permissions: toPermissions({
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
    }),
  },
  reviewer: {
    description: `Independent review agent covering correctness, security, performance, maintainability, and quality gates.`,
    mode: 'subagent',
    permissions: toPermissions({
      bash: bashPermissions(
        [['*', 'ask']],
        [...allow('git status*', 'git rev-parse*', 'vp*', 'rtk*', 'node*'), ...guardedReconGit()],
      ),
      edit: 'deny',
      glob: 'allow',
      grep: 'allow',
      lsp: 'allow',
      read: 'allow',
      skill: 'allow',
      webfetch: 'allow',
    }),
  },
};
