import type { ExtensionAPI, SessionStartEvent } from '@oh-my-pi/pi-coding-agent';

import { deploySpecialistAgents } from '@/agents.js';
import { createCommandsApi, installCommands } from '@/commands.js';
import { createCompactionApi, installCompactionHandlers } from '@/compaction.js';
import {
  createGoalApi,
  installGoalEventHandlers,
  restoreMaestriaStateForSession,
} from '@/goals.js';
import { createModeCommandsApi, installModeAutoDetect, installModeCommands } from '@/modes.js';
import { createModePromptHandler } from '@/rules.js';
import { createInitialState } from '@/state.js';
import { installNativeSubagentTool } from '@/subagent.js';
import { createToolApi, installToolInterceptors } from '@/tools.js';

const extension = (pi: ExtensionAPI): void => {
  const state = createInitialState();
  const cleanups: (() => void)[] = [];

  // Install mode commands: /fein, /sonar, /blitz
  installModeCommands(createModeCommandsApi(pi), state);
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
  installCompactionHandlers(createCompactionApi(pi), state);

  // Install orchestration hooks: subagent tool and commands
  installNativeSubagentTool(pi, state, cleanups);
  installCommands(createCommandsApi(pi), state);

  // Mirror OMP's native goal state (goal_updated event) into Maestria state
  installGoalEventHandlers(createGoalApi(pi), state);

  // Cleanup subscriptions on shutdown
  pi.on('session_shutdown', () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
    cleanups.length = 0;
  });

  // Install tool call interceptors for review mode and dangerous patterns
  installToolInterceptors(createToolApi(pi), state);
};

export default extension;
