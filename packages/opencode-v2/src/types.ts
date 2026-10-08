// Plugin context and domain types for the V2 API (ground truth: @opencode/plugin/effect).
import type { Plugin } from '@opencode/plugin/effect';

export type PluginContext = Plugin.Context;

export type { SessionContext } from '@opencode/plugin/effect/session';
export type { AgentEditor } from '@opencode/plugin/effect/agent';
export type { ReferenceEditor } from '@opencode/plugin/effect/reference';
export type { CommandEditor } from '@opencode/plugin/effect/command';
export type { SkillEditor } from '@opencode/plugin/effect/skill';
export type { Transform } from '@opencode/plugin/effect/registration';
