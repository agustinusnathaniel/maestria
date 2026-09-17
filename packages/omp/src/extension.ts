import type { ExtensionAPI, SessionStartEvent } from '@oh-my-pi/pi-coding-agent';
import { installCompactionHandlers } from '@maestria/shared-pi/compaction-core';
import { createInitialState } from '@maestria/shared-pi/state-core';

import { deploySpecialistAgents } from '@/agents.js';
import { installCommands } from '@/commands.js';
import {
  createGoalApi,
  installGoalEventHandlers,
  restoreMaestriaStateForSession,
} from '@/goals.js';
import { installModeAutoDetect, installModeCommands } from '@/modes.js';
import { createModePromptHandler } from '@/rules.js';
import { installNativeSubagentTool } from '@/subagent.js';
import { installToolInterceptors } from '@/tools.js';

const extension = (pi: ExtensionAPI): void => {
  const state = createInitialState();

  // Install mode commands: /fein, /sonar, /blitz
  installModeCommands(pi, state);
  installModeAutoDetect(pi, state);

  // Inject mode prompt when a workflow mode is active
  const handleModePrompt = createModePromptHandler(state);

  pi.on('before_agent_start', (event, ctx) => handleModePrompt(event, ctx));

  // Deploy specialist agent files for omp subagent discovery
  pi.on('session_start', (_event: SessionStartEvent, ctx) => {
    deploySpecialistAgents();

    // Restore the complete target-session state from public session entries.
    restoreMaestriaStateForSession(state, ctx);
  });

  // Install compaction preservation handlers
  installCompactionHandlers(pi, state);

  // Install orchestration hooks: subagent tool and commands
  installNativeSubagentTool(pi, state);
  installCommands(pi, state);

  // Mirror OMP's native goal state (goal_updated event) into Maestria state
  installGoalEventHandlers(createGoalApi(pi), state);

  // Install tool call interceptors for review mode and dangerous patterns
  installToolInterceptors(pi, state);
};

export default extension;
