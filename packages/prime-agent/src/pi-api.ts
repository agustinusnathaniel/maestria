// packages/prime-agent/src/pi-api.ts
// Prime-compatible extension API types (vendored, type-only).
//
// Prime Agent is Pi rebranded: the Prime fork of `@earendil-works/pi-coding-agent`
// (version 0.7.2, `piConfig.name = "prime-agent"`, config dir `.prime/agent`) is
// NOT published to npm (the npm registry carries only the original Pi line,
// latest 0.84.1), and the compiled Prime binary serves the pi packages to
// extensions through bundled jiti virtual modules. A Prime extension therefore
// never resolves `@earendil-works/pi-coding-agent` from node_modules: it
// receives the live `ExtensionAPI` object as the default-export factory's
// argument and consumes it at runtime.
//
// This module mirrors the PUBLIC extension types of the pinned Prime fork,
// exactly for the members this package uses:
//
//   Source: PrimeIntellect-ai/prime-agent @ 7787f07415d843b9a800f6a4720e0c739bd608e5
//   File:   packages/coding-agent/src/core/extensions/types.ts (exported via
//           packages/coding-agent/src/index.ts and `main`/`types` of the
//           package manifest)
//   Docs:   packages/coding-agent/docs/extensions.md (events, ExtensionContext,
//           ExtensionCommandContext, ExtensionAPI methods)
//
// Only type imports are used; the compiled `dist/extension.mjs` has zero
// imports of any pi package, so this package declares no runtime or peer
// dependency on `@earendil-works/pi-coding-agent` (see docs/packages.md of the
// pinned fork: pi core packages are bundled by Prime; any package importing
// them at runtime must list them in peerDependencies with "*" and not bundle).
// Reverify against the pinned commit before extending this subset.

// ---------------------------------------------------------------------------
// Session entries (state persistence)
// ---------------------------------------------------------------------------

/**
 * Session entry shape as returned by ReadonlySessionManager reads. Aligned to
 * the pinned fork's `SessionEntryBase` (`packages/coding-agent/src/core/
 * session-manager.ts`): all fields are required on read - `id`, `parentId`
 * (null for the root entry), and an ISO-string `timestamp`.
 */
export interface SessionEntryBase {
  type: string;
  /** Session-tree node id (entry id in the session tree). */
  id: string;
  /** Parent node id for the session tree; null for the root entry. */
  parentId: string | null;
  /** Entry timestamp (ISO string in the pinned fork). */
  timestamp: string;
}

/**
 * Custom entry for extensions to store extension-specific data in the session.
 * Mirrors the fork's `CustomEntry`: `type: "custom"`, a `customType` to
 * identify the entry, and `data`. Custom entries do NOT participate in LLM
 * context; they persist across reloads and compaction.
 */
export interface CustomEntry<T = unknown> extends SessionEntryBase {
  type: 'custom';
  customType: string;
  data?: T;
}

/**
 * Read-only subset of the fork's `SessionEntry` union (which has 14 members):
 * this package only reads `custom` entries and the base fields. Because
 * `SessionEntryBase.type` is a plain `string`, `type === "custom"` does not
 * discriminate the union at the type level; consumers cast to read the
 * optional `customType` (see src/state.ts).
 */
export type SessionEntry = CustomEntry | SessionEntryBase;

/**
 * Read-only view of the session manager exposed to extension handlers
 * (`ExtensionContext.sessionManager`). Mirrors the fork's `ReadonlySessionManager`
 * (a `Pick` of `SessionManager`); this package uses `getBranch()` (the current
 * branch, never a sibling branch of the session tree) and `getEntries()`.
 */
export interface ReadonlySessionManager {
  getBranch(fromId?: string): SessionEntry[];
  getEntries(): SessionEntry[];
}

// ---------------------------------------------------------------------------
// Contexts
// ---------------------------------------------------------------------------

/** UI methods usable from extension handlers. */
export interface ExtensionUIContext {
  notify(message: string, type?: 'info' | 'warning' | 'error'): void;
  /** Replace the core input editor text (used by the status command). */
  setEditorText(text: string): void;
}

/** Context passed to extension event handlers. */
export interface ExtensionContext {
  ui: ExtensionUIContext;
  hasUI: boolean;
  cwd: string;
  sessionManager: ReadonlySessionManager;
}

/** Extended context for command handlers (session-control methods not used). */
export type ExtensionCommandContext = ExtensionContext;

// ---------------------------------------------------------------------------
// Events and event results
// ---------------------------------------------------------------------------

export interface SessionStartEvent {
  type: 'session_start';
  reason: 'startup' | 'reload' | 'new' | 'resume' | 'fork';
  previousSessionFile?: string;
}

export interface SessionTreeEvent {
  type: 'session_tree';
  newLeafId: string | null;
  oldLeafId: string | null;
}

/**
 * Fired before each agent loop. `systemPrompt` is the chained system prompt as
 * of this handler; returning `{ systemPrompt }` replaces it for the turn and is
 * chained across handlers.
 */
export interface BeforeAgentStartEvent {
  type: 'before_agent_start';
  prompt: string;
  systemPrompt: string;
}

export interface BeforeAgentStartEventResult {
  /** Replace the system prompt for this turn (chained across handlers). */
  systemPrompt?: string;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

export interface RegisteredCommandOptions {
  description?: string;
  handler: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
}

// ---------------------------------------------------------------------------
// ExtensionAPI
// ---------------------------------------------------------------------------

export interface ExtensionAPI {
  on(
    event: 'session_start',
    handler: (event: SessionStartEvent, ctx: ExtensionContext) => unknown,
  ): void;
  on(
    event: 'session_tree',
    handler: (event: SessionTreeEvent, ctx: ExtensionContext) => unknown,
  ): void;
  on(
    event: 'before_agent_start',
    handler: (
      event: BeforeAgentStartEvent,
      ctx: ExtensionContext,
    ) => Promise<BeforeAgentStartEventResult | void> | BeforeAgentStartEventResult | void,
  ): void;

  registerCommand(name: string, options: RegisteredCommandOptions): void;

  /**
   * Send a user message to the agent. Always triggers a turn; when the agent is
   * streaming, `deliverAs` controls how the message is queued.
   */
  sendUserMessage(content: string, options?: { deliverAs?: 'steer' | 'followUp' }): void;

  /** Append a custom entry to the session (persists, not sent to the LLM). */
  appendEntry(customType: string, data?: unknown): void;
}

/** Default-export factory loaded by Prime's extension loader. */
export type ExtensionFactory = (pi: ExtensionAPI) => void | Promise<void>;
