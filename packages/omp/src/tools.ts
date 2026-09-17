import type { ExtensionAPI } from '@oh-my-pi/pi-coding-agent';
import { createToolCallHandler } from '@maestria/shared-pi/tools-core';

import type { MaestriaState } from '@maestria/shared-pi/state-core';
import { persistState } from '@maestria/shared-pi/state-core';

export type ToolApi = Pick<ExtensionAPI, 'appendEntry' | 'getActiveTools' | 'on'>;

export const installToolInterceptors = (pi: ToolApi, state: MaestriaState): void => {
  const handler = createToolCallHandler({
    delegationTool: 'task',
    getActiveTools: () => pi.getActiveTools(),
    getState: () => state,
    isBashTool: (e) => e.toolName === 'bash',
    isMutationTool: (e) => ['edit', 'write', 'patch', 'bash', 'goal'].includes(e.toolName ?? ''),
    isReadTool: (e) => e.toolName === 'read',
    isWriteTool: (e) => ['edit', 'write'].includes(e.toolName ?? ''),
    persist: () => {
      persistState(pi, state);
    },
  });
  pi.on('tool_call', handler);
};
