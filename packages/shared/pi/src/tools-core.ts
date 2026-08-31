/**
 * Shared tool interceptor utilities for Maestria platform packages.
 *
 * Pure TypeScript - no platform-specific dependencies.
 * Imported by both @maestria/omp and @maestria/pi to eliminate duplication.
 *
 * @module
 */

import {
  persistState as persistStateCore,
  recordFileModified,
  recordFileRead,
} from './state-core.js';
import type { MaestriaState } from './state-core.js';

/**
 * Dangerous bash command patterns that should always be blocked,
 * regardless of mode or specialist role.
 */
export const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+\//u,
  /dd\s+if=/u,
  />\s*\/dev\/sd/u,
  /chmod\s+-R\s+777\s+\//u,
  /mkfs\.\w+/u,
  /:\(\)\{ :\|:& \};:/u,
  />\s*\/etc\/(?<targetFile>passwd|shadow|sudoers)/u,
  /\beval\b/u,
  /wget\s+-O\s*-\s*\|\s*(?<wgetShell>bash|sh)/u,
  /curl\s+.*\|\s*(?<curlShell>bash|sh)/u,
  /crontab\s+-r/u,
];

/**
 * Read-only bash command prefixes allowed for the orchestrator's recon and
 * verification. Anything not matching - or chaining into a mutation - is
 * blocked; mutations belong to specialists.
 */
const READ_ONLY_BASH_PREFIX =
  /^(?<command>ls|cat|head|tail|git status|git diff|git log|git branch|find|grep|rg|pnpm test|npm test|pwd|which)\b/u;

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
export const isReadOnlyBashCommand = (rawCommand: string): boolean => {
  const command = rawCommand.trim();
  if (command.includes('$(') || command.includes('`')) {
    return false;
  }
  // Strip `2>&1`-style fd redirects first so the `&` inside them is not
  // mistaken for a command separator and the `>` is not counted as output
  // redirection.
  const withoutFdRedirects = command.replaceAll(/\d?>&[12]/gu, '');
  if (withoutFdRedirects.includes('>')) {
    return false;
  }
  return withoutFdRedirects
    .split(/[\n;&|]+/u)
    .every((segment) => READ_ONLY_BASH_PREFIX.test(segment.trim()));
};

// ── Pure helpers ──

export const findDangerousPattern = (command: string): RegExp | null => {
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) {
      return pattern;
    }
  }
  return null;
};

/** Alias for findDangerousPattern - returns matching pattern or null. */
export const isDangerousCommand = findDangerousPattern;

export const shouldBlockForOrchestrator = (
  state: { mode: unknown },
  activeTools: string[],
  delegationTool: string,
): boolean => state.mode !== null && activeTools.includes(delegationTool);

export const getBlockedReviewReason = (toolName: string): string | null => {
  if (toolName === 'edit' || toolName === 'write' || toolName === 'bash') {
    return 'Review mode is active. Report findings, do not edit.';
  }
  return null;
};

export const isOrchestratorBlocked = (
  state: { mode: unknown },
  activeTools: string[],
  delegationTool: string,
): boolean => shouldBlockForOrchestrator(state, activeTools, delegationTool);

export const findDangerousPatternForCommand = (command: string): RegExp | null =>
  findDangerousPattern(command);

// ── Factory ──

export interface ToolCallEventLike {
  toolName?: string;
  input?: unknown;
}

export interface ToolCallContext {
  hasUI?: boolean;
  ui?: { confirm: (title: string, msg: string) => Promise<boolean> };
}

export interface ToolCallResult {
  block: boolean;
  reason: string;
}

export type ToolCallHandler = (
  event: ToolCallEventLike,
  ctx: ToolCallContext,
) => Promise<ToolCallResult | undefined>;

export interface ToolCallHandlerOptions {
  getState: () => MaestriaState;
  getActiveTools: () => string[];
  delegationTool: string;
  delegationHint?: string;
  extraMutations?: string[];
  isMutationTool?: (event: ToolCallEventLike) => boolean;
  isReadTool: (event: ToolCallEventLike) => boolean;
  isWriteTool: (event: ToolCallEventLike) => boolean;
  isBashTool: (event: ToolCallEventLike) => boolean;
  persist?: () => void;
  pi?: { appendEntry: (type: string, data: unknown) => void };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const resolveDelegationHint = (delegationTool: string, hint?: string): string =>
  hint ??
  (delegationTool === 'task'
    ? "Use 'maestria_subagent' or 'task()' to delegate mutations to specialists."
    : "Use 'maestria_subagent' to delegate mutations to specialists.");

const checkOrchestratorBlock = (
  state: MaestriaState,
  event: ToolCallEventLike,
  options: ToolCallHandlerOptions,
  delegationTool: string,
  hint: string,
): { block: boolean; reason: string } | undefined => {
  if (state.mode === null || !options.getActiveTools().some((t) => t === delegationTool)) {
    return undefined;
  }
  const isMutationTool =
    options.isMutationTool ??
    ((e: ToolCallEventLike) => {
      const name = e.toolName ?? '';
      const base = name === 'edit' || name === 'write' || name === 'patch' || name === 'bash';
      if (base) {
        return true;
      }
      return options.extraMutations?.some((m) => m === name) === true;
    });
  if (!isMutationTool(event) || event.toolName === delegationTool) {
    return undefined;
  }
  if (options.isBashTool(event)) {
    const input = isRecord(event.input) ? event.input : undefined;
    const command = typeof input?.command === 'string' ? input.command : '';
    if (isReadOnlyBashCommand(command)) {
      return undefined;
    }
  }
  return {
    block: true,
    reason: `Tool '${event.toolName}' is blocked for the orchestrator. ${hint}`,
  };
};

const checkDangerousPattern = async (
  event: ToolCallEventLike,
  options: ToolCallHandlerOptions,
  ctx: ToolCallContext,
): Promise<{ block: boolean; reason: string } | undefined> => {
  if (!options.isBashTool(event)) {
    return undefined;
  }
  const input = isRecord(event.input) ? event.input : undefined;
  if (!input) {
    return undefined;
  }
  const { command } = input;
  if (typeof command !== 'string' || !command) {
    return undefined;
  }
  const matched = findDangerousPattern(command);
  if (!matched) {
    return undefined;
  }
  if (ctx.hasUI === true && ctx.ui) {
    const confirmed = await ctx.ui.confirm(
      'Dangerous Pattern Detected',
      `This command matches a dangerous pattern:\n${command}\nProceed?`,
    );
    if (confirmed) {
      return undefined;
    }
  }
  return { block: true, reason: `Command matches dangerous pattern: ${matched}` };
};

const trackFileAccess = (
  state: MaestriaState,
  event: ToolCallEventLike,
  options: ToolCallHandlerOptions,
): boolean => {
  if (options.isReadTool(event)) {
    const p = isRecord(event.input) ? event.input.path : undefined;
    if (typeof p === 'string' && p) {
      Object.assign(state, recordFileRead(state, p));
      return true;
    }
  } else if (options.isWriteTool(event)) {
    const p = isRecord(event.input) ? event.input.path : undefined;
    if (typeof p === 'string' && p) {
      Object.assign(state, recordFileModified(state, p));
      return true;
    }
  }
  return false;
};

export const createToolCallHandler = (options: ToolCallHandlerOptions): ToolCallHandler => {
  const { delegationTool } = options;
  const hint = resolveDelegationHint(delegationTool, options.delegationHint);
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
    ctx: ToolCallContext,
  ): Promise<{ block: boolean; reason: string } | undefined> => {
    if (event.toolName === undefined || event.toolName === '') {
      return undefined;
    }
    const state = options.getState();
    const { toolName } = event;
    const orchestrator = checkOrchestratorBlock(state, event, options, delegationTool, hint);
    if (orchestrator) {
      return orchestrator;
    }
    if (state.reviewMode && (options.isWriteTool(event) || options.isBashTool(event))) {
      const reason =
        getBlockedReviewReason(toolName) ?? 'Review mode is active. Report findings, do not edit.';
      return { block: true, reason };
    }
    const dangerous = await checkDangerousPattern(event, options, ctx);
    if (dangerous) {
      return dangerous;
    }
    if (trackFileAccess(state, event, options)) {
      doPersist();
    }
    return undefined;
  };
};
