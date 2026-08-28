/**
 * Shared tool interceptor utilities for Maestria platform packages.
 *
 * Pure TypeScript - no platform-specific dependencies.
 * Imported by both @maestria/omp and @maestria/pi to eliminate duplication.
 *
 * @module
 */

import {
  type MaestriaState,
  persistState as persistStateCore,
  recordFileModified,
  recordFileRead,
} from './state-core.js';

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
 * verification. Anything not matching - or chaining into a mutation - is
 * blocked; mutations belong to specialists.
 */
const READ_ONLY_BASH_PREFIX =
  /^(ls|cat|head|tail|git status|git diff|git log|git branch|find|grep|rg|pnpm test|npm test|pwd|which)\b/;

/**
 * True when a bash command performs no mutation.
 *
 * A naive prefix check is bypassable - `git status && git checkout .` or
 * `ls; rm -rf dist` both pass a prefix-only match - so every segment of a
 * chained command (`;`, `&&`, `||`, `|`, or newline) must itself be
 * read-only, and command substitution (`$(...)`, backticks) and output
 * redirection (`>` / `>>`) are rejected because they can hide a mutation
 * behind a read-only prefix. `2>&1`-style fd redirects are allowed (they
 * don't write).
 */
export function isReadOnlyBashCommand(rawCommand: string): boolean {
  const command = rawCommand.trim();
  if (command.includes('$(') || command.includes('`')) return false;
  // Strip `2>&1`-style fd redirects first so the `&` inside them is not
  // mistaken for a command separator and the `>` is not counted as output
  // redirection.
  const withoutFdRedirects = command.replace(/\d?>&[12]/g, '');
  if (withoutFdRedirects.includes('>')) return false;
  return withoutFdRedirects
    .split(/[\n;&|]+/)
    .every((segment) => READ_ONLY_BASH_PREFIX.test(segment.trim()));
}

// ── Pure helpers ──

export function findDangerousPattern(command: string): RegExp | null {
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) return pattern;
  }
  return null;
}

/** Alias for findDangerousPattern - returns matching pattern or null. */
export const isDangerousCommand = findDangerousPattern;

export function shouldBlockForOrchestrator(
  state: { mode: unknown },
  activeTools: string[],
  delegationTool: string,
): boolean {
  return state.mode !== null && activeTools.includes(delegationTool);
}

export function getBlockedReviewReason(toolName: string): string | null {
  if (toolName === 'edit' || toolName === 'write' || toolName === 'bash') {
    return 'Review mode is active. Report findings, do not edit.';
  }
  return null;
}

export function isOrchestratorBlocked(
  state: { mode: unknown },
  activeTools: string[],
  delegationTool: string,
): boolean {
  return shouldBlockForOrchestrator(state, activeTools, delegationTool);
}

export function findDangerousPatternForCommand(command: string): RegExp | null {
  return findDangerousPattern(command);
}

// ── Factory ──

export interface ToolCallEventLike {
  toolName?: string;
  input?: unknown;
}

export interface ToolCallHandlerOptions {
  getState(): MaestriaState;
  getActiveTools(): string[];
  delegationTool: string;
  delegationHint?: string;
  extraMutations?: string[];
  isMutationTool?(event: ToolCallEventLike): boolean;
  isReadTool(event: ToolCallEventLike): boolean;
  isWriteTool(event: ToolCallEventLike): boolean;
  isBashTool(event: ToolCallEventLike): boolean;
  persist?: () => void;
  pi?: { appendEntry: (type: string, data: unknown) => void };
}

export function createToolCallHandler(options: ToolCallHandlerOptions) {
  const delegationTool = options.delegationTool;
  const hint =
    options.delegationHint ??
    (delegationTool === 'task'
      ? "Use 'maestria_subagent' or 'task()' to delegate mutations to specialists."
      : "Use 'maestria_subagent' to delegate mutations to specialists.");

  const defaultIsMutation = (event: ToolCallEventLike): boolean => {
    const name = (event as { toolName?: string }).toolName ?? '';
    const base = name === 'edit' || name === 'write' || name === 'patch' || name === 'bash';
    if (base) return true;
    if (options.extraMutations?.includes(name)) return true;
    return false;
  };

  const doPersist = (): void => {
    if (options.persist) {
      options.persist();
      return;
    }
    if (options.pi) {
      persistStateCore(options.pi, options.getState());
    }
  };

  return async (
    event: ToolCallEventLike,
    ctx: { hasUI?: boolean; ui?: { confirm: (title: string, msg: string) => Promise<boolean> } },
  ): Promise<{ block: boolean; reason: string } | undefined> => {
    if (!event || !(event as { toolName?: unknown }).toolName) return undefined;
    const state = options.getState();
    const toolName = (event as { toolName: string }).toolName;
    // Wrap optional method in arrow to avoid unbound-method diagnostic when
    // the callback is a detached object method.
    const isMutationTool = options.isMutationTool
      ? (e: ToolCallEventLike) => options.isMutationTool!(e)
      : defaultIsMutation;

    // ── Orchestrator routing enforcement ──
    if (state.mode !== null && options.getActiveTools().includes(delegationTool)) {
      const isMutation = isMutationTool(event);
      if (isMutation && toolName !== delegationTool) {
        if (options.isBashTool(event)) {
          const input = (event as { input?: unknown }).input as { command?: unknown } | undefined;
          const command = typeof input?.command === 'string' ? input.command : '';
          if (isReadOnlyBashCommand(command)) {
            return undefined;
          }
        }
        return {
          block: true,
          reason: `Tool '${toolName}' is blocked for the orchestrator. ${hint}`,
        };
      }
    }

    // ── Review mode ──
    if (state.reviewMode) {
      if (options.isWriteTool(event) || options.isBashTool(event)) {
        const reason =
          getBlockedReviewReason(toolName) ??
          'Review mode is active. Report findings, do not edit.';
        return { block: true, reason };
      }
    }

    // ── Dangerous patterns ──
    if (options.isBashTool(event)) {
      const input = (event as { input?: unknown }).input;
      if (!input || typeof input !== 'object') return undefined;
      const command = (input as Record<string, unknown>).command;
      if (typeof command === 'string' && command) {
        const matched = findDangerousPattern(command);
        if (matched) {
          if (ctx?.hasUI) {
            const confirmed = await ctx.ui!.confirm(
              'Dangerous Pattern Detected',
              `This command matches a dangerous pattern:\n${command}\nProceed?`,
            );
            if (confirmed) return undefined;
          }
          return {
            block: true,
            reason: `Command matches dangerous pattern: ${matched}`,
          };
        }
      }
    }

    // ── File tracking (ADR-PI-002) ──
    let tracked = false;
    if (options.isReadTool(event)) {
      const path = (event as { input?: unknown }).input as Record<string, unknown> | undefined;
      const p = path?.path;
      if (typeof p === 'string' && p) {
        Object.assign(state, recordFileRead(state, p));
        tracked = true;
      }
    } else if (options.isWriteTool(event)) {
      const path = (event as { input?: unknown }).input as Record<string, unknown> | undefined;
      const p = path?.path;
      if (typeof p === 'string' && p) {
        Object.assign(state, recordFileModified(state, p));
        tracked = true;
      }
    }
    if (tracked) {
      doPersist();
    }

    return undefined;
  };
}
