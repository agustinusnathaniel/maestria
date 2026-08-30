// packages/prime-agent/src/state.ts
// Minimal session-scoped state for the Prime extension: the active workflow
// mode (fein/sonar/blitz) or none.
//
// State is persisted through the host session API (`pi.appendEntry`) as a
// `custom` session entry with `customType: "maestria_mode"`. Custom entries
// are session entries: they survive reloads, forks, and compaction, and they
// are NOT part of LLM context. Restore reads only the current branch
// (`sessionManager.getBranch()`), never a sibling branch of the session tree,
// mirroring the @maestria/pi extension's state pattern. No files are written
// (no `~/.pi`, no `.prime/agent` writes); everything rides on the host session.

import type { CustomEntry, ExtensionAPI, SessionEntry } from './pi-api.js';

/** Session entry type used to persist the active mode. */
export const MODE_STATE_CUSTOM_TYPE = 'maestria_mode';

export interface MaestriaModeState {
  /** Active workflow mode, or null when neutral routing is active. */
  mode: 'fein' | 'sonar' | 'blitz' | null;
}

export function createInitialState(): MaestriaModeState {
  return { mode: null };
}

function isCustomEntry(entry: SessionEntry): entry is CustomEntry & { data?: MaestriaModeState } {
  // SessionEntryBase.type is a plain string, so a discriminated-union narrowing
  // on `type` does not apply; cast to read the optional customType.
  const maybe = entry as SessionEntry & { customType?: string };
  return maybe.type === 'custom' && maybe.customType === MODE_STATE_CUSTOM_TYPE;
}

function isModeState(value: unknown): value is MaestriaModeState {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const mode = (value as Record<string, unknown>).mode;
  return mode === null || mode === 'fein' || mode === 'sonar' || mode === 'blitz';
}

/**
 * Read the mode state from the current session branch: the most recent
 * `maestria_mode` custom entry wins. Returns null when no entry exists.
 */
export function readModeStateFromEntries(
  entries: SessionEntry[] | null | undefined,
): MaestriaModeState | null {
  if (!Array.isArray(entries)) {
    return null;
  }
  // Entries are returned in tree order; the last matching entry is the most
  // recently appended one on the current branch.
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (isCustomEntry(entry) && isModeState(entry.data)) {
      return entry.data;
    }
  }
  return null;
}

/** Persist the current mode as a session custom entry (no LLM context). */
export function persistModeState(pi: ExtensionAPI, state: MaestriaModeState): void {
  pi.appendEntry(MODE_STATE_CUSTOM_TYPE, { mode: state.mode });
}

/**
 * Restore the mode state from the current session branch into `state`.
 * When the branch has no `maestria_mode` entry, mode resets to null
 * (fail-closed: never inherit a sibling branch's mode).
 */
export function restoreModeState(
  state: MaestriaModeState,
  entries: SessionEntry[] | null | undefined,
): void {
  const persisted = readModeStateFromEntries(entries);
  state.mode = persisted?.mode ?? null;
}
