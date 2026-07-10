import type { ExtensionAPI, SessionStartEvent } from '@earendil-works/pi-coding-agent';
import { createInitialState } from '@/state.js';
import { deploySpecialistAgents } from '@/agents.js';
import { installModeCommands } from '@/modes.js';
import { createModePromptHandler } from '@/rules.js';
import { installCompactionHandlers } from '@/compaction.js';
import { installSubagentTool } from '@/subagent.js';
import { installCommands } from '@/commands.js';
import { installToolInterceptors } from '@/tools.js';

export default function (pi: ExtensionAPI): void {
  const state = createInitialState();
  const cleanups: Array<() => void> = [];

  // Install mode commands: /fein, /sonar, /blitz
  installModeCommands(pi, state);

  // Inject mode prompt when a workflow mode is active
  const handleModePrompt = createModePromptHandler(state);

  pi.on('before_agent_start', (event, ctx) => {
    return handleModePrompt(event, ctx);
  });

  // Deploy specialist agent files for pi-subagents discovery
  pi.on('session_start', (_event: SessionStartEvent, ctx) => {
    deploySpecialistAgents(ctx);

    // Restore persisted state on session start (reload/resume/fork)
    if (!ctx.sessionManager?.getEntries) return;
    const entries = ctx.sessionManager.getEntries();
    // Walk from newest to oldest, find the last persisted maestria_state entry
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i];
      if (entry.type === 'custom' && entry.customType === 'maestria_state') {
        const data = entry.data;
        if (data && typeof data === 'object') {
          Object.assign(state, data);
        }
        break;
      }
    }
  });

  // Install compaction preservation handlers
  installCompactionHandlers(pi, state);

  // Install orchestration hooks: subagent tool and commands
  installSubagentTool(pi, state, cleanups);
  installCommands(pi, state);

  // Cleanup subscriptions on shutdown
  pi.on('session_shutdown', () => {
    for (const cleanup of cleanups) cleanup();
    cleanups.length = 0;
  });

  // Install tool call interceptors for review mode and dangerous patterns
  installToolInterceptors(pi, state);
}
