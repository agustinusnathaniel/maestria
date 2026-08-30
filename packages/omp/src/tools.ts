import type { ExtensionAPI } from '@oh-my-pi/pi-coding-agent';
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
    delegationTool: 'task',
    isMutationTool: (e) => {
      return ['edit', 'write', 'patch', 'bash', 'goal'].includes(
        (e as { toolName?: string }).toolName ?? '',
      );
    },
    isReadTool: (e) => {
      return (e as { toolName?: string }).toolName === 'read';
    },
    isWriteTool: (e) => {
      return ['edit', 'write'].includes((e as { toolName?: string }).toolName ?? '');
    },
    isBashTool: (e) => {
      return (e as { toolName?: string }).toolName === 'bash';
    },
    persist: () => {
      return persistState(pi as unknown as { appendEntry: (t: string, d: unknown) => void }, state);
    },
  });
  pi.on('tool_call', handler as never);
}
