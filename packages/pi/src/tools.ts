import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { createToolCallHandler } from '@maestria/shared-pi/tools-core';

import type { MaestriaState } from '@maestria/shared-pi/state-core';
import { persistState } from '@maestria/shared-pi/state-core';

export type ToolApi = Pick<ExtensionAPI, 'appendEntry' | 'getActiveTools' | 'on'>;

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
