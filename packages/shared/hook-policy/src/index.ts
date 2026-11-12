// Host-neutral hook policy: pure functions over command text and file heads.
// The source is split into one module per job plus shared shell parsing; the
// package entry below is the full public surface. Plugin hooks run as plain
// Node scripts outside any package install, so scripts/sync-hook-policy.ts
// bundles these modules into the single import-free
// packages/agent-plugins/hooks/lib/policy.mjs. Module contract (enforced by
// the bundler, which fails loud instead of shipping a wrong artifact):
// relative `./x.js` value and `import type` lines only, no dynamic imports,
// no default exports, no re-exports outside this entry, unique top-level
// value names across modules, and no top-level cross-module value evaluation
// (shared bindings are only read inside function bodies, so bundle order can
// never hit a temporal-dead-zone). Keep this package dependency-free.
export type { Decision, ShellContext, Verdict } from './types.js';
export { ALLOW, strictest } from './types.js';
export { splitCommands } from './shell.js';
export { classifyGitSafety, PROTECTED_BRANCH } from './git.js';
export { classifyEnvDump } from './env.js';
export { classifyEmailScan, findEmails, maskEmail, outgoingText } from './email.js';
export { classifyGeneratedEdit, editTargets, generatedMarker } from './generated.js';
