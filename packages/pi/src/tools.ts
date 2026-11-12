import type { ExtensionAPI, UserBashEventResult } from '@earendil-works/pi-coding-agent';
import { checkShellSafety, createToolCallHandler } from '@maestria/shared-pi/tools-core';
import type { ToolCallContext } from '@maestria/shared-pi/tools-core';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

import type { MaestriaState } from '@maestria/shared-pi/state-core';
import { persistState } from '@maestria/shared-pi/state-core';

export type ToolApi = Pick<ExtensionAPI, 'appendEntry' | 'getActiveTools' | 'on'>;

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
    const blocked = await checkShellSafety(
      event.command,
      { ...ctx, cwd: event.cwd },
      currentBranch,
    );
    return blocked === undefined
      ? undefined
      : { result: { cancelled: false, exitCode: 1, output: blocked.reason, truncated: false } };
  };

/**
 * Registers the only maestria layer in this Pi extension that observes a
 * `tool_call`, so it carries the interceptor half of the enforcement boundary:
 * the review-mode and sonar blocks here, and the git-safety guard. The other
 * half is review-mode narrowing of the host tool list, applied in
 * `commands-core.ts` and restored by `review-core.ts`. Narrowing can only
 * withhold tools the host already exposes, and neither half reaches a call the
 * host does not surface. A host execution mode that runs invocations in-script
 * without emitting `tool_call` (codemode is one example) removes this
 * interceptor; whether review-mode narrowing still binds then is a separate
 * question, because it depends on the host honoring the active tool list for
 * in-script invocations. See ADR-PI-003.
 */
export const installToolInterceptors = (pi: ToolApi, state: MaestriaState): void => {
  const handler = createToolCallHandler({
    currentBranch,
    delegationTool: 'subagent',
    getActiveTools: () => pi.getActiveTools(),
    getState: () => state,
    isBashTool: (e) => e.toolName === 'bash',
    isMutationTool: (e) =>
      e.toolName === 'edit' ||
      e.toolName === 'write' ||
      e.toolName === 'patch' ||
      e.toolName === 'bash',
    isReadTool: (e) => e.toolName === 'read',
    isWriteTool: (e) => e.toolName === 'edit' || e.toolName === 'write',
    persist: () => {
      persistState(pi, state);
    },
  });
  pi.on('tool_call', handler);
  pi.on('user_bash', createUserBashGuard());
};
