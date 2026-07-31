// Plugin context and domain types for the V2 beta API.
// Imported from the real @opencode-ai/plugin package (ground truth).
// The package root re-exports Plugin as a namespace and does not re-export
// domain types at the top level, so domain types come from subpath imports.

import type { Plugin } from '@opencode-ai/plugin';
import type { SessionContext } from '@opencode-ai/plugin/promise/session';
import type { AgentDraft } from '@opencode-ai/plugin/promise/agent';
import type { Hooks, Transform, Registration } from '@opencode-ai/plugin/promise/registration';

// Plugin.Context resolves through the namespace re-export in the package root.
export type PluginContext = Plugin.Context;

// Convenience re-exports so the rest of the code imports from a single place.
export type { SessionContext, AgentDraft, Hooks, Transform, Registration };
