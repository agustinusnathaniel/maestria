import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { createToolCallHandler } from '@maestria/shared-pi/tools-core';
import type { ToolCallHandler } from '@maestria/shared-pi/tools-core';

import type { MaestriaState } from '@/state.js';
import { persistState } from '@/state.js';

export interface ToolApi {
  appendEntry: (type: string, data: unknown) => void;
  getActiveTools: () => string[];
  on: (event: 'tool_call', handler: ToolCallHandler) => void;
}

export const createToolApi = (pi: ExtensionAPI): ToolApi => ({
  appendEntry: (type, data) => {
    pi.appendEntry(type, data);
  },
  getActiveTools: () => pi.getActiveTools(),
  on: (_event, handler) => {
    pi.on('tool_call', async (event, ctx) => await handler(event, ctx));
  },
});

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
