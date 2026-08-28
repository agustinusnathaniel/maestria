// Plugin context and domain types for the V2 beta API.
// Effect API: ground truth from @opencode-ai/plugin/effect

import type { Plugin } from '@opencode-ai/plugin/effect';
import type { SessionContext } from '@opencode-ai/plugin/effect/session';
import type { AgentDraft } from '@opencode-ai/plugin/effect/agent';
import type { ReferenceDraft } from '@opencode-ai/plugin/effect/reference';
import type { CommandDraft } from '@opencode-ai/plugin/effect/command';
import type { SkillDraft } from '@opencode-ai/plugin/effect/skill';
import type { Hooks, Transform, Registration } from '@opencode-ai/plugin/effect/registration';

export type PluginContext = Plugin.Context;

export type {
  SessionContext,
  AgentDraft,
  ReferenceDraft,
  CommandDraft,
  SkillDraft,
  Hooks,
  Transform,
  Registration,
};
