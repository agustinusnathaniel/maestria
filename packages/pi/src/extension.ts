import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { createInitialState } from './state.js';
import { installModeCommands } from './modes.js';
import { createBeforeAgentStartHandler } from './rules.js';
import { installCompactionHandlers } from './compaction.js';
import { installSubagentTool } from './subagent.js';
import { installCommands } from './commands.js';
import { installToolInterceptors } from './tools.js';

export default function (pi: ExtensionAPI): void {
  const state = createInitialState();

  // Install mode commands: /fein, /sonar, /blitz
  installModeCommands(pi, state);

  // Inject mode prompts when a mode is active
  const handleBeforeAgentStart = createBeforeAgentStartHandler(state);

  pi.on('before_agent_start', (event, ctx) => {
    return handleBeforeAgentStart(event, ctx);
  });

  // Install compaction preservation handlers
  installCompactionHandlers(pi, state);

  // Install orchestration hooks: subagent tool and commands
  installSubagentTool(pi, state);
  installCommands(pi, state);

  // Install tool call interceptors for review mode and dangerous patterns
  installToolInterceptors(pi, state);
}
