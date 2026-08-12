/**
 * Shared tool interceptor utilities for Maestria platform packages.
 *
 * Pure TypeScript — no platform-specific dependencies.
 * Imported by both @maestria/omp and @maestria/pi to eliminate duplication.
 *
 * @module
 */

/**
 * Dangerous bash command patterns that should always be blocked,
 * regardless of mode or specialist role.
 */
export const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+\//,
  /dd\s+if=/,
  />\s*\/dev\/sd/,
  /chmod\s+-R\s+777\s+\//,
  /mkfs\.\w+/,
  /:(){ :\|:& };:/,
  />\s*\/etc\/(passwd|shadow|sudoers)/,
  /\beval\b/,
  /wget\s+-O\s*-\s*\|\s*(bash|sh)/,
  /curl\s+.*\|\s*(bash|sh)/,
  /crontab\s+-r/,
];

/**
 * Read-only bash command prefixes allowed for the orchestrator's recon and
 * verification. Anything not matching — or chaining into a mutation — is
 * blocked; mutations belong to specialists.
 */
const READ_ONLY_BASH_PREFIX =
  /^(ls|cat|head|tail|git status|git diff|git log|git branch|find|grep|rg|pnpm test|npm test|pwd|which)\b/;

/**
 * True when a bash command performs no mutation.
 *
 * A naive prefix check is bypassable — `git status && git checkout .` or
 * `ls; rm -rf dist` both pass a prefix-only match — so every segment of a
 * chained command (`;`, `&&`, `||`, `|`, or newline) must itself be
 * read-only, and command substitution (`$(...)`, backticks) and output
 * redirection (`>` / `>>`) are rejected because they can hide a mutation
 * behind a read-only prefix. `2>&1`-style fd redirects are allowed (they
 * don't write).
 */
export function isReadOnlyBashCommand(rawCommand: string): boolean {
  const command = rawCommand.trim();
  if (command.includes('$(') || command.includes('`')) return false;
  if (command.replace(/2?>&[12]/g, '').includes('>')) return false;
  return command.split(/[\n;&|]+/).every((segment) => READ_ONLY_BASH_PREFIX.test(segment.trim()));
}
