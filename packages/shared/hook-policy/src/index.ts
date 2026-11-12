// Declarative hosts need a standalone module; scripts/sync-hook-policy.ts bundles this entry.
// Keep runtime imports relative and inside this tree, with no dependencies or dynamic imports.
export type { Decision, ShellContext, Verdict } from './types.js';
export { ALLOW, strictest } from './types.js';
export { splitCommands } from './shell.js';
export { classifyGitSafety, PROTECTED_BRANCH } from './git.js';
export { classifyEnvDump } from './env.js';
export { classifyEmailScan, findEmails, maskEmail, outgoingText } from './email.js';
export { classifyGeneratedEdit, editTargets, generatedMarker } from './generated.js';
