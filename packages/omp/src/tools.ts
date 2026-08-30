import type { ExtensionAPI } from '@oh-my-pi/pi-coding-agent';
import type { MaestriaState } from '@/state.js';
import { createToolCallHandler } from '@maestria/shared-pi/tools-core';
import { persistState } from '@/state.js';

export function installToolInterceptors(pi: ExtensionAPI, state: MaestriaState): void {
  const handler = createToolCallHandler({
    getState: () => state,
    getActiveTools: () => pi.getActiveTools(),
    delegationTool: 'task',
    isMutationTool: (e) =>
      ['edit', 'write', 'patch', 'bash', 'goal'].includes(
        (e as { toolName?: string }).toolName ?? '',
      ),
    isReadTool: (e) => (e as { toolName?: string }).toolName === 'read',
    isWriteTool: (e) => ['edit', 'write'].includes((e as { toolName?: string }).toolName ?? ''),
    isBashTool: (e) => (e as { toolName?: string }).toolName === 'bash',
    persist: () =>
      persistState(pi as unknown as { appendEntry: (t: string, d: unknown) => void }, state),
  });
  pi.on('tool_call', handler as never);
}
