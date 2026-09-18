// Plugin context and domain types for the V2 beta API.
// Effect API: ground truth from @opencode-ai/plugin/effect

import type { Plugin } from '@opencode-ai/plugin/effect';

export type PluginContext = Plugin.Context;

export type { SessionContext } from '@opencode-ai/plugin/effect/session';
export type { AgentDraft } from '@opencode-ai/plugin/effect/agent';
export type { ReferenceDraft } from '@opencode-ai/plugin/effect/reference';
export type { CommandDraft } from '@opencode-ai/plugin/effect/command';
export type { SkillDraft } from '@opencode-ai/plugin/effect/skill';
export type { Hooks, Registration, Transform } from '@opencode-ai/plugin/effect/registration';
