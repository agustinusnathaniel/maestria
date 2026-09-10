import type {
  ExtensionAPI,
  SessionStartEvent,
  SessionTreeEvent,
} from '@earendil-works/pi-coding-agent';
import {
  readSessionBranch,
  replaceState,
  stateFromSessionEntries,
} from '@maestria/shared-pi/state-core';

import { deploySpecialistAgents } from '@/agents.js';
import { createCommandsApi, installCommands } from '@/commands.js';
import { createCompactionApi, installCompactionHandlers } from '@/compaction.js';
import { createModeCommandsApi, installModeAutoDetect, installModeCommands } from '@/modes.js';
import { createModePromptHandler } from '@/rules.js';
import { createInitialState } from '@/state.js';
import { installSubagentTool } from '@/subagent.js';
import { createSubagentToolApi } from '@/subagent-api.js';
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

  // Deploy specialist agent files for pi-subagents discovery
  pi.on('session_start', (_event: SessionStartEvent, ctx) => {
    deploySpecialistAgents();

    // Restore persisted state on session start (reload/resume/fork)
    replaceState(state, stateFromSessionEntries(readSessionBranch(ctx)));
  });

  // Rehydrate state when navigating the session tree to a different branch
  pi.on('session_tree', (_event: SessionTreeEvent, ctx) => {
    replaceState(state, stateFromSessionEntries(readSessionBranch(ctx)));
  });

  // Install compaction preservation handlers
  installCompactionHandlers(createCompactionApi(pi), state);

  // Install orchestration hooks: subagent tool and commands
  installSubagentTool(createSubagentToolApi(pi), state, cleanups);
  installCommands(createCommandsApi(pi), state);

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
