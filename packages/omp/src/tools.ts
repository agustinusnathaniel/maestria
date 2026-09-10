import { createToolCallHandler } from '@maestria/shared-pi/tools-core';
import type { ToolCallEventLike } from '@maestria/shared-pi/tools-core';

import type { MaestriaState } from '@maestria/shared-pi/state-core';
import { persistState } from '@maestria/shared-pi/state-core';

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
