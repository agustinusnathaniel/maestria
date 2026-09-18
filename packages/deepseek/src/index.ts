import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { Context } from '@deepseek-ai/cordis';
import type { SkillService } from '@deepseek-ai/dsh-skill';
import type { SystemPrompt } from '@deepseek-ai/dsh-system-prompt';

import { createMaestriaSkillProvider, parseSkillFile } from './skills.js';

/**
 * Maestria methodology plugin for DeepSeek Harness.
 *
 * Contributions (all into host registries, none published as services):
 * - ordered system-prompt sections for workflow routing and (optionally) the
 *   global rules,
 * - named prompt variables carrying each specialist's persona text, consumed
 *   by the Maestria agent preset's `dsh-tool-subagent` rows,
 * - a `ctx.skills` provider exposing the package's generated skill tree.
 *
 * The plugin imports host packages as types only; the DSH runtime provides
 * every implementation at composition time.
 */

export const name = 'maestria';

export const inject = ['systemPrompt', 'skills'] as const;

/** Canonical specialist roles exposed as prompt variables and delegation personas. */
export const MAESTRIA_SPECIALISTS = [
  'adventurer',
  'architect',
  'builder',
  'diagnose',
  'planner',
  'reviewer',
  'writer',
] as const;

/** The registry surface this plugin actually touches, picked from the real services. */
export interface MaestriaPluginContext {
  readonly systemPrompt: Pick<SystemPrompt, 'section' | 'variable'>;
  readonly skills: Pick<SkillService, 'registerProvider'>;
}

/**
 * Compile-time compatibility gate: the real augmented host context must remain
 * assignable to the structural surface declared above. If a DSH update breaks
 * this, the package fails to typecheck instead of failing at mount time.
 */
type HostContextCompatible = [Context] extends [MaestriaPluginContext] ? true : false;
export const HOST_CONTEXT_COMPATIBLE: HostContextCompatible = true;

export interface MaestriaPluginConfig {
  /**
   * Register the global-rules skill body as a system-prompt section. The
   * Maestria agent preset enables this; standalone mounts leave rules to the
   * `global-rules` skill so agents opt in through the orchestrator routing.
   */
  readonly injectGlobalRules?: boolean;
  /** Register the workflow-routing prompt section (default true). */
  readonly injectRoutingSection?: boolean;
  /** Override the generated skills directory (default: the package's `skills/`). */
  readonly skillsDir?: string;
}

const MAESTRIA_ROUTING_SECTION = `## Maestria workflow routing

Route every non-trivial request through the Maestria pipeline before acting:

- **direct** - single focused change with no open uncertainty: proceed as builder yourself.
- **focused** - one specialist stage (reconnaissance, planning, diagnosis, or review): delegate to the matching \`maestria_<role>\` tool when present, otherwise load the matching skill and follow it.
- **full** - multi-stage work: reconnaissance or planning first, implementation, then independent review. Keep review independent: the reviewer must not implement its own findings.

Preserve handoffs between stages: outcome, constraints, evidence, blockers, and next steps. Respect iteration limits: bounded attempts, escalate instead of looping. Workflow modes \`fein\` (full), \`sonar\` (research-only), and \`blitz\` (fast) are available as skills and set the route for the whole request.`;

interface MaestriaPluginResolvedConfig {
  readonly injectGlobalRules: boolean;
  readonly injectRoutingSection: boolean;
  readonly skillsDir: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readBooleanFlag = (value: unknown, key: string): boolean | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'boolean') {
    throw new TypeError(`maestria plugin config field '${key}' must be a boolean`);
  }
  return value;
};

/**
 * Validate plugin composition config at the boundary: the Cordis loader hands
 * the `cordis.yml` entry's config over as unstructured data, so anything not
 * matching the documented schema fails the mount loudly.
 */
export const resolveMaestriaPluginConfig = (
  config: unknown,
  defaultSkillsDir: string,
): MaestriaPluginResolvedConfig => {
  if (config !== undefined && !isRecord(config)) {
    throw new Error('maestria plugin config must be an object');
  }
  const source: Record<string, unknown> = config ?? {};
  const injectGlobalRules = readBooleanFlag(source.injectGlobalRules, 'injectGlobalRules');
  const injectRoutingSection = readBooleanFlag(source.injectRoutingSection, 'injectRoutingSection');
  const { skillsDir } = source;
  if (skillsDir !== undefined && typeof skillsDir !== 'string') {
    throw new Error("maestria plugin config field 'skillsDir' must be a string");
  }
  return {
    injectGlobalRules: injectGlobalRules ?? false,
    injectRoutingSection: injectRoutingSection ?? true,
    skillsDir: skillsDir ?? defaultSkillsDir,
  };
};

export const apply = (ctx: MaestriaPluginContext, config?: MaestriaPluginConfig): void => {
  const resolved = resolveMaestriaPluginConfig(
    config,
    path.resolve(import.meta.dirname, '../skills'),
  );
  const { systemPrompt } = ctx;

  // Load every generated skill once at mount: synchronous reads keep apply()
  // side-effect-free for the host and make a missing or malformed generated
  // file fail composition loudly before any session joins, per DSH's
  // broken-plugin rule.
  const bodies = new Map<string, string>();
  for (const skillName of ['orchestrator', 'global-rules', ...MAESTRIA_SPECIALISTS]) {
    const skillPath = path.join(resolved.skillsDir, skillName, 'SKILL.md');
    const parsed = parseSkillFile(readFileSync(skillPath, 'utf-8'), skillPath);
    bodies.set(skillName, parsed.content);
  }

  if (resolved.injectRoutingSection) {
    systemPrompt.section({
      name: 'maestria:routing',
      order: 160,
      text: MAESTRIA_ROUTING_SECTION,
    });
  }

  if (resolved.injectGlobalRules) {
    const globalRules = bodies.get('global-rules');
    if (globalRules !== undefined) {
      systemPrompt.section({
        name: 'maestria:global-rules',
        order: 150,
        text: globalRules,
      });
    }
  }

  // One variable per persona consumed by the Maestria preset's delegation
  // tools: `persona: '{{maestria_<role>}}'`. Canonical content stays
  // single-sourced in the generated skills; the preset references it.
  const personaNames = ['orchestrator', ...MAESTRIA_SPECIALISTS] as const;
  for (const personaName of personaNames) {
    const body = bodies.get(personaName);
    if (body !== undefined) {
      systemPrompt.variable(`maestria_${personaName}`, () => body);
    }
  }

  ctx.skills.registerProvider(createMaestriaSkillProvider(resolved.skillsDir, 'maestria'));
};

export default apply;
