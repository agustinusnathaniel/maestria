import { isToolCallEventType, type ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { MaestriaState } from '@/state.js';
import { createToolCallHandler } from '@maestria/shared-pi/tools-core';
import { persistState } from '@/state.js';

export function installToolInterceptors(pi: ExtensionAPI, state: MaestriaState): void {
  const handler = createToolCallHandler({
    getState: () => {
      return state;
    },
    getActiveTools: () => {
      return pi.getActiveTools();
    },
    delegationTool: 'subagent',
    isMutationTool: (e) => {
      return (
        isToolCallEventType('edit', e as never) ||
        isToolCallEventType('write', e as never) ||
        isToolCallEventType('patch', e as never) ||
        (e as { toolName?: string }).toolName === 'bash'
      );
    },
    isReadTool: (e) => {
      return isToolCallEventType('read', e as never);
    },
    isWriteTool: (e) => {
      return isToolCallEventType('edit', e as never) || isToolCallEventType('write', e as never);
    },
    isBashTool: (e) => {
      return isToolCallEventType('bash', e as never);
    },
    persist: () => {
      return persistState(pi as unknown as { appendEntry: (t: string, d: unknown) => void }, state);
    },
  });
  pi.on('tool_call', handler as never);
}
