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
