/** Shared tool interceptor utilities for Pi-family packages. */

import {
  persistState as persistStateCore,
  recordFileModified,
  recordFileRead,
} from './state-core.js';
import type { MaestriaState } from './state-core.js';
import { isReadOnlyBashCommand } from './bash-policy.js';

export { isReadOnlyBashCommand } from './bash-policy.js';

/** Bash patterns that are always blocked, regardless of mode or role. */
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

export const REVIEW_READ_ONLY_TOOLS = ['read', 'grep', 'find', 'ls', 'glob'] as const;

const REVIEW_READ_ONLY_TOOL_SET: ReadonlySet<string> = new Set(REVIEW_READ_ONLY_TOOLS);

export const findDangerousPattern = (command: string): RegExp | null => {
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) {
      return pattern;
    }
  }
  return null;
};

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
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isMutationToolEvent = (
  event: ToolCallEventLike,
  options: ToolCallHandlerOptions,
): boolean => {
  if (options.isMutationTool !== undefined) {
    return options.isMutationTool(event);
  }
  const name = event.toolName ?? '';
  return (
    ['bash', 'edit', 'patch', 'write'].includes(name) ||
    options.extraMutations?.some((mutation) => mutation === name) === true
  );
};

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
  if (state.mode === null || !options.getActiveTools().some((tool) => tool === delegationTool)) {
    return undefined;
  }
  if (!isMutationToolEvent(event, options) || event.toolName === delegationTool) {
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
  if (input === undefined) {
    return undefined;
  }
  const { command } = input;
  if (typeof command !== 'string' || command === '') {
    return undefined;
  }
  const matched = findDangerousPattern(command);
  if (matched === null) {
    return undefined;
  }
  if (ctx.hasUI === true && ctx.ui !== undefined) {
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
    const filePath = isRecord(event.input) ? event.input.path : undefined;
    if (typeof filePath === 'string' && filePath !== '') {
      Object.assign(state, recordFileRead(state, filePath));
      return true;
    }
  } else if (options.isWriteTool(event)) {
    const filePath = isRecord(event.input) ? event.input.path : undefined;
    if (typeof filePath === 'string' && filePath !== '') {
      Object.assign(state, recordFileModified(state, filePath));
      return true;
    }
  }
  return false;
};

export const createToolCallHandler = (options: ToolCallHandlerOptions): ToolCallHandler => {
  const { delegationTool } = options;
  const hint = resolveDelegationHint(delegationTool, options.delegationHint);
  const doPersist = (): void => {
    if (options.persist !== undefined) {
      options.persist();
      return;
    }
    if (options.pi !== undefined) {
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
    const orchestrator = checkOrchestratorBlock(state, event, options, delegationTool, hint);
    if (orchestrator !== undefined) {
      return orchestrator;
    }
    const reviewBlocked =
      state.reviewMode &&
      (event.toolName === delegationTool ||
        isMutationToolEvent(event, options) ||
        !REVIEW_READ_ONLY_TOOL_SET.has(event.toolName));
    if (reviewBlocked) {
      return {
        block: true,
        reason: 'Review mode is active. Only read-only inspection tools are allowed.',
      };
    }
    const dangerous = await checkDangerousPattern(event, options, ctx);
    if (dangerous !== undefined) {
      return dangerous;
    }
    if (trackFileAccess(state, event, options)) {
      doPersist();
    }
    return undefined;
  };
};
