import type { ExtensionAPI, UserBashEventResult } from '@earendil-works/pi-coding-agent';
import { classifyEnvDump, classifyGitSafety, strictest } from '@maestria/shared-hook-policy';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

import { isReadOnlyBashCommand } from '@/bash-policy.js';
import { persistState, recordFileModified, recordFileRead } from '@/state.js';
import type { MaestriaState } from '@/state.js';

export type ToolApi = Pick<ExtensionAPI, 'appendEntry' | 'on'>;

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

/**
 * The review-mode tool set. `glob` is not a built-in Pi tool, but extensions may register it, and
 * listing it is a no-op when absent.
 */
export const REVIEW_READ_ONLY_TOOLS = ['read', 'grep', 'find', 'ls', 'glob'] as const;

const REVIEW_READ_ONLY_TOOL_SET: ReadonlySet<string> = new Set(REVIEW_READ_ONLY_TOOLS);
const DELEGATION_TOOLS: ReadonlySet<string> = new Set(['maestria_subagent', 'subagent']);
const MUTATION_TOOLS: ReadonlySet<string> = new Set(['bash', 'edit', 'patch', 'write']);
const WRITE_TOOLS: ReadonlySet<string> = new Set(['edit', 'write']);

const SONAR_HINT =
  'sonar is research-only: investigate and report without changing files or dispatching subagents.';

export const findDangerousPattern = (command: string): RegExp | null =>
  DANGEROUS_PATTERNS.find((pattern) => pattern.test(command)) ?? null;

export interface ToolCallEventLike {
  toolName?: string;
  input?: unknown;
}

export interface ToolCallContext {
  cwd?: string;
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const inputField = (event: ToolCallEventLike, key: string): string => {
  const value = isRecord(event.input) ? event.input[key] : undefined;
  return typeof value === 'string' ? value : '';
};

/** Current branch of the repository at `directory` under `cwd`, or undefined outside one. */
export const currentBranch = (cwd: string | undefined, directory?: string): string | undefined => {
  let branch: string | undefined;
  try {
    branch = execFileSync(
      'git',
      ['-C', path.resolve(cwd ?? process.cwd(), directory ?? '.'), 'branch', '--show-current'],
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000 },
    ).trim();
  } catch {
    // Not a repository, or git is missing: the branch is unknown.
  }
  return branch === '' ? undefined : branch;
};

const checkSonarBlock = (
  state: MaestriaState,
  toolName: string,
  command: string,
): ToolCallResult | undefined => {
  if (state.mode !== 'sonar' || !(DELEGATION_TOOLS.has(toolName) || MUTATION_TOOLS.has(toolName))) {
    return undefined;
  }
  if (toolName === 'bash' && isReadOnlyBashCommand(command)) {
    return undefined;
  }
  return { block: true, reason: `Tool '${toolName}' is blocked. ${SONAR_HINT}` };
};

const checkDangerousPattern = async (
  command: string,
  ctx: ToolCallContext,
): Promise<ToolCallResult | undefined> => {
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

/**
 * Shell safety from the shared hook policy: hook bypasses are blocked, and risky history edits
 * and whole-environment dumps need the user's confirmation, which a session without a UI cannot
 * give.
 */
export const checkShellSafety = async (
  command: string,
  ctx: ToolCallContext,
): Promise<ToolCallResult | undefined> => {
  const decision = strictest([
    classifyGitSafety(command, {
      currentBranch: (directory) => currentBranch(ctx.cwd, directory),
    }),
    classifyEnvDump(command),
  ]);
  if (decision.verdict === 'allow') {
    return undefined;
  }
  const reason = `maestria: ${decision.reason}.`;
  if (decision.verdict === 'ask' && ctx.hasUI === true && ctx.ui !== undefined) {
    if (await ctx.ui.confirm('Confirm shell command', `${reason}\n\n${command}\n\nProceed?`)) {
      return undefined;
    }
    return { block: true, reason: `${reason} The user declined.` };
  }
  return {
    block: true,
    reason:
      decision.verdict === 'ask'
        ? `${reason} It needs the user's explicit approval and this session cannot ask for it: stop, ask the user, and continue only if they approve.`
        : reason,
  };
};

const trackFileAccess = (state: MaestriaState, event: ToolCallEventLike): boolean => {
  const filePath = inputField(event, 'path');
  if (filePath === '') {
    return false;
  }
  if (event.toolName === 'read') {
    Object.assign(state, recordFileRead(state, filePath));
    return true;
  }
  if (WRITE_TOOLS.has(event.toolName ?? '')) {
    Object.assign(state, recordFileModified(state, filePath));
    return true;
  }
  return false;
};

/**
 * Shell safety for the user's own `!cmd` and `!!cmd` shell commands, which bypass `tool_call`.
 * A blocked command returns its reason as the result instead of running.
 */
export const createUserBashGuard =
  () =>
  async (
    event: { command: string; cwd: string },
    ctx: ToolCallContext,
  ): Promise<UserBashEventResult | undefined> => {
    const blocked = await checkShellSafety(event.command, { ...ctx, cwd: event.cwd });
    return blocked === undefined
      ? undefined
      : { result: { cancelled: false, exitCode: 1, output: blocked.reason, truncated: false } };
  };

const createToolCallHandler =
  (pi: ToolApi, state: MaestriaState): ToolCallHandler =>
  async (event, ctx): Promise<ToolCallResult | undefined> => {
    const { toolName } = event;
    if (toolName === undefined || toolName === '') {
      return undefined;
    }
    const command = toolName === 'bash' ? inputField(event, 'command') : '';
    const sonar = checkSonarBlock(state, toolName, command);
    if (sonar !== undefined) {
      return sonar;
    }
    if (state.reviewMode && !REVIEW_READ_ONLY_TOOL_SET.has(toolName)) {
      return {
        block: true,
        reason: 'Review mode is active. Only read-only inspection tools are allowed.',
      };
    }
    if (command !== '') {
      const blocked =
        (await checkDangerousPattern(command, ctx)) ?? (await checkShellSafety(command, ctx));
      if (blocked !== undefined) {
        return blocked;
      }
    }
    if (trackFileAccess(state, event)) {
      persistState(pi, state);
    }
    return undefined;
  };

/**
 * Registers the only maestria layer in this Pi extension that observes a
 * `tool_call`, so it carries the interceptor half of the enforcement boundary:
 * the review-mode and sonar blocks here, and the git-safety guard. The other
 * half is review-mode narrowing of the host tool list, applied in
 * `commands.ts` and restored by `review.ts`. Narrowing can only
 * withhold tools the host already exposes, and neither half reaches a call the
 * host does not surface. A host execution mode that runs invocations in-script
 * without emitting `tool_call` (codemode is one example) removes this
 * interceptor; whether review-mode narrowing still binds then is a separate
 * question, because it depends on the host honoring the active tool list for
 * in-script invocations. See ADR-PI-003.
 */
export const installToolInterceptors = (pi: ToolApi, state: MaestriaState): void => {
  pi.on('tool_call', createToolCallHandler(pi, state));
  pi.on('user_bash', createUserBashGuard());
};
