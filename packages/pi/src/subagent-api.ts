import { defineTool } from '@earendil-works/pi-coding-agent';
import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';

import type {
  PiToolUpdateHandler,
  SubagentToolApi,
  SubagentToolDefinition,
  SubagentToolParams,
  ToolResult,
} from '@/subagent.js';

export const createSubagentToolApi = (pi: ExtensionAPI): SubagentToolApi => ({
  appendEntry: (type, data) => {
    pi.appendEntry(type, data);
  },
  events: pi.events,
  registerTool: (tool: SubagentToolDefinition) => {
    pi.registerTool(
      defineTool({
        ...tool,
        async execute(
          toolCallId: string,
          params: SubagentToolParams,
          signal: AbortSignal | undefined,
          onUpdate: PiToolUpdateHandler,
          ctx: ExtensionContext,
        ): Promise<ToolResult> {
          return await tool.execute(toolCallId, params, signal, onUpdate, ctx);
        },
      }),
    );
  },
});
