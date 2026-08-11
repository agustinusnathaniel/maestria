import type {
  ExtensionAPI,
  ExtensionContext,
  SessionStartEvent,
  SessionTreeEvent,
} from '@earendil-works/pi-coding-agent';
import { createInitialState } from '@/state.js';
import type { MaestriaState } from '@/state.js';
import { deploySpecialistAgents } from '@/agents.js';
import { installModeCommands, installModeAutoDetect } from '@/modes.js';
import { createModePromptHandler } from '@/rules.js';
import { installCompactionHandlers } from '@/compaction.js';
import { installSubagentTool } from '@/subagent.js';
import { installCommands } from '@/commands.js';
import { installToolInterceptors } from '@/tools.js';

interface PersistedStateEntry {
  type: string;
  customType?: string;
  data?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function currentSessionEntries(ctx: ExtensionContext): PersistedStateEntry[] | null {
  // getBranch() is the public current-session view and avoids restoring state
  // from a sibling branch in the same session tree. Never fall back to
  // getEntries(), which spans the entire session tree.
  const sessionManager = ctx?.sessionManager;
  if (typeof sessionManager?.getBranch !== 'function') return null;

  const branch = sessionManager.getBranch();
  return Array.isArray(branch) ? (branch as PersistedStateEntry[]) : null;
}

function restoreStateFromSession(state: MaestriaState, ctx: ExtensionContext): void {
  const next = createInitialState();
  const entries = currentSessionEntries(ctx);

  if (!entries) {
    const mutableState = state as unknown as Record<string, unknown>;
    for (const key of Object.keys(mutableState)) delete mutableState[key];
    Object.assign(state, next);
    return;
  }

  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry.type === 'custom' && entry.customType === 'maestria_state') {
      if (isRecord(entry.data)) Object.assign(next, entry.data);
      break;
    }
  }

  const mutableState = state as unknown as Record<string, unknown>;
  for (const key of Object.keys(mutableState)) delete mutableState[key];
  Object.assign(state, next);
}

export default function (pi: ExtensionAPI): void {
  const state = createInitialState();
  const cleanups: Array<() => void> = [];

  // Install mode commands: /fein, /sonar, /blitz
  installModeCommands(pi, state);
  installModeAutoDetect(pi, state);

  // Inject mode prompt when a workflow mode is active
  const handleModePrompt = createModePromptHandler(state);

  pi.on('before_agent_start', (event, ctx) => {
    return handleModePrompt(event, ctx);
  });

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
