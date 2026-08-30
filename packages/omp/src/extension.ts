import type { ExtensionAPI, SessionStartEvent } from '@oh-my-pi/pi-coding-agent';
import { createInitialState } from '@/state.js';
import { deploySpecialistAgents } from '@/agents.js';
import { installModeCommands, installModeAutoDetect } from '@/modes.js';
import { createModePromptHandler } from '@/rules.js';
import { installCompactionHandlers } from '@/compaction.js';
import { installSubagentTool } from '@/subagent.js';
import { installCommands } from '@/commands.js';
import { installToolInterceptors } from '@/tools.js';
import { installGoalEventHandlers, restoreMaestriaStateForSession } from '@/goals.js';

export default function (pi: ExtensionAPI): void {
  const state = createInitialState();
  const cleanups: (() => void)[] = [];

  // Install mode commands: /fein, /sonar, /blitz
  installModeCommands(pi, state);
  installModeAutoDetect(pi, state);

  // Inject mode prompt when a workflow mode is active
  const handleModePrompt = createModePromptHandler(state);

  pi.on('before_agent_start', (event, ctx) => handleModePrompt(event, ctx));

  // Deploy specialist agent files for omp subagent discovery
  pi.on('session_start', (_event: SessionStartEvent, ctx) => {
    deploySpecialistAgents(ctx);

    // Restore the complete target-session state from public session entries.
    restoreMaestriaStateForSession(state, ctx);
  });

  // Install compaction preservation handlers
  installCompactionHandlers(pi, state);

  // Install orchestration hooks: subagent tool and commands
  installSubagentTool(pi, state, cleanups);
  installCommands(pi, state);

  // Mirror OMP's native goal state (goal_updated event) into Maestria state
  installGoalEventHandlers(pi, state);

  // Cleanup subscriptions on shutdown
  pi.on('session_shutdown', () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
    cleanups.length = 0;
  });

  // Install tool call interceptors for review mode and dangerous patterns
  installToolInterceptors(pi, state);
}
