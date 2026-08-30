import { isToolCallEventType } from '@earendil-works/pi-coding-agent';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { MaestriaState } from '@/state.js';
import { createToolCallHandler } from '@maestria/shared-pi/tools-core';
import { persistState } from '@/state.js';

export function installToolInterceptors(pi: ExtensionAPI, state: MaestriaState): void {
  const handler = createToolCallHandler({
    delegationTool: 'subagent',
    getActiveTools: () => pi.getActiveTools(),
    getState: () => state,
    isBashTool: (e) => isToolCallEventType('bash', e as never),
    isMutationTool: (e) =>
      isToolCallEventType('edit', e as never) ||
      isToolCallEventType('write', e as never) ||
      isToolCallEventType('patch', e as never) ||
      (e as { toolName?: string }).toolName === 'bash',
    isReadTool: (e) => isToolCallEventType('read', e as never),
    isWriteTool: (e) =>
      isToolCallEventType('edit', e as never) || isToolCallEventType('write', e as never),
    persist: () => {
      persistState(pi, state);
    },
  });
  pi.on('tool_call', handler as never);
}
