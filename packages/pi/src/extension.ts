import type {
  ExtensionAPI,
  ExtensionContext,
  SessionStartEvent,
  SessionTreeEvent,
} from '@earendil-works/pi-coding-agent';

import { deploySpecialistAgents } from '@/agents.js';
import { createCommandsApi, installCommands } from '@/commands.js';
import { createCompactionApi, installCompactionHandlers } from '@/compaction.js';
import { createModeCommandsApi, installModeAutoDetect, installModeCommands } from '@/modes.js';
import { createModePromptHandler } from '@/rules.js';
import { createInitialState } from '@/state.js';
import type { MaestriaState } from '@/state.js';
import { installSubagentTool } from '@/subagent.js';
import { createSubagentToolApi } from '@/subagent-api.js';
import { createToolApi, installToolInterceptors } from '@/tools.js';

interface PersistedStateEntry {
  type: string;
  customType?: string;
  data?: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const currentSessionEntries = (ctx: ExtensionContext): PersistedStateEntry[] | null => {
  // getBranch() is the public current-session view and avoids restoring state
  // from a sibling branch in the same session tree. Never fall back to
  // getEntries(), which spans the entire session tree.
  const sessionManager = ctx?.sessionManager;
  if (typeof sessionManager?.getBranch !== 'function') {
    return null;
  }

  const branch = sessionManager.getBranch();
  return Array.isArray(branch) ? branch : null;
};

const clearState = (state: MaestriaState): void => {
  for (const key of Object.keys(state)) {
    Reflect.deleteProperty(state, key);
  }
};

const restoreStateFromSession = (state: MaestriaState, ctx: ExtensionContext): void => {
  const next = createInitialState();
  const entries = currentSessionEntries(ctx);

  if (!entries) {
    clearState(state);
    Object.assign(state, next);
    return;
  }

  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const entry = entries[i];
    if (entry.type === 'custom' && entry.customType === 'maestria_state') {
      if (isRecord(entry.data)) {
        Object.assign(next, entry.data);
      }
      break;
    }
  }

  clearState(state);
  Object.assign(state, next);
};

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
    deploySpecialistAgents(ctx);

    // Restore persisted state on session start (reload/resume/fork)
    restoreStateFromSession(state, ctx);
  });

  // Rehydrate state when navigating the session tree to a different branch
  pi.on('session_tree', (_event: SessionTreeEvent, ctx) => {
    restoreStateFromSession(state, ctx);
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
