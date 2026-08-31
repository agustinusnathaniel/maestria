import { createToolCallHandler } from '@maestria/shared-pi/tools-core';
import type { ToolCallEventLike } from '@maestria/shared-pi/tools-core';
import type { ExtensionAPI } from '@oh-my-pi/pi-coding-agent';

import type { MaestriaState } from '@/state.js';
import { persistState } from '@/state.js';

export interface ToolContext {
  hasUI?: boolean;
  ui?: { confirm: (title: string, message: string) => Promise<boolean> };
}

export interface ToolResult {
  block: boolean;
  reason: string;
}

export type ToolHandler = (
  event: ToolCallEventLike,
  ctx: ToolContext,
) => Promise<ToolResult | undefined>;

export interface ToolApi {
  appendEntry: (type: string, data: unknown) => void;
  getActiveTools: () => string[];
  on: (event: 'tool_call', handler: ToolHandler) => void;
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
