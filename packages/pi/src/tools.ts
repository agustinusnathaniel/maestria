import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { createToolCallHandler } from '@maestria/shared-pi/tools-core';

import type { MaestriaState } from '@maestria/shared-pi/state-core';
import { persistState } from '@maestria/shared-pi/state-core';

export type ToolApi = Pick<ExtensionAPI, 'appendEntry' | 'getActiveTools' | 'on'>;

/**
 * Registers the only maestria layer that observes a `tool_call`, so it carries
 * the whole enforcement boundary: read-only and orchestrator blocks here,
 * review-mode narrowing of the host tool list in `review-core.ts`. Narrowing
 * can only withhold tools the host already exposes, and neither half reaches a
 * call the host does not surface. A host execution mode that runs invocations
 * in-script without emitting `tool_call` (codemode is one example) therefore
 * removes tool-level enforcement entirely. See ADR-PI-003.
 */
export const installToolInterceptors = (pi: ToolApi, state: MaestriaState): void => {
  const handler = createToolCallHandler({
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
};
