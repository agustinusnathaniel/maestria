// Host-neutral hook policy: pure functions over command text and file heads.
// The source is split into one module per job plus shared shell parsing; the
// package entry below is the full public surface. Plugin hooks run as plain
// Node scripts outside any package install, so scripts/sync-hook-policy.ts
// bundles these modules into the single import-free
// packages/agent-plugins/hooks/lib/policy.mjs. Keep cross-module imports to
// relative `./x.js` value and `import type` lines, keep this entry to named
// `export { ... } from` and `export type { ... } from` lines, and keep this
// package dependency-free.
export type { Decision, ShellContext, Verdict } from './types.js';
export { ALLOW, strictest } from './types.js';
export { splitCommands } from './shell.js';
export { classifyGitSafety, PROTECTED_BRANCH } from './git.js';
export { classifyEnvDump } from './env.js';
export { classifyEmailScan, findEmails, maskEmail, outgoingText } from './email.js';
export { classifyGeneratedEdit, editTargets, generatedMarker } from './generated.js';
