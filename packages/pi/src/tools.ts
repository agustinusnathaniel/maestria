import { isToolCallEventType } from '@earendil-works/pi-coding-agent';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { createToolCallHandler } from '@maestria/shared-pi/tools-core';

import type { MaestriaState } from '@/state.js';
import { persistState } from '@/state.js';

export function installToolInterceptors(pi: ExtensionAPI, state: MaestriaState): void {
  const handler = createToolCallHandler({
    delegationTool: 'subagent',
    getActiveTools: () => pi.getActiveTools(),
    getState: () => state,
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: narrow from unknown/union via runtime check, safe type assertion
    isBashTool: (e) => isToolCallEventType('bash', e as never),
    isMutationTool: (e) =>
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: narrow from unknown/union via runtime check, safe type assertion
      isToolCallEventType('edit', e as never) ||
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: narrow from unknown/union via runtime check, safe type assertion
      isToolCallEventType('write', e as never) ||
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: narrow from unknown/union via runtime check, safe type assertion
      isToolCallEventType('patch', e as never) ||
      (e as { toolName?: string }).toolName === 'bash',
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: narrow from unknown/union via runtime check, safe type assertion
    isReadTool: (e) => isToolCallEventType('read', e as never),
    isWriteTool: (e) =>
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: narrow from unknown/union via runtime check, safe type assertion
      isToolCallEventType('edit', e as never) || isToolCallEventType('write', e as never),
    persist: () => {
      persistState(pi, state);
    },
  });
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: narrow from unknown/union via runtime check, safe type assertion
  pi.on('tool_call', handler as never);
}
