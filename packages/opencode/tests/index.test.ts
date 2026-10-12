import type { Config } from '@opencode-ai/plugin';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vite-plus/test';

import { pluginInput } from './helpers.js';

import { MaestriaPlugin } from '@/index.js';

type AgentConfig = NonNullable<NonNullable<Config['agent']>[string]>;
// The plugin SDK's v1 Config type predates `skills`; OpenCode reads `skills.paths` at runtime.
type SkillsConfig = Config & { skills?: { paths?: string[]; urls?: string[] } };

const getAgentConfig = (config: Config, name: string): AgentConfig => {
  const agent = config.agent?.[name];
  if (agent === undefined) {
    throw new Error(`Expected agent config for ${name}`);
  }
  return agent;
};

describe('plugin structure', () => {
  it('should load all 8 agents', async () => {
    const plugin = await MaestriaPlugin(pluginInput);
    const config: Config = { agent: {} };
    await plugin.config?.(config);

    const agentNames = Object.keys(config.agent ?? {});
    expect(agentNames).toContain('orchestrator');
    expect(agentNames).toContain('adventurer');
    expect(agentNames).toContain('architect');
    expect(agentNames).toContain('builder');
    expect(agentNames).toContain('diagnose');
    expect(agentNames).toContain('planner');
    expect(agentNames).toContain('reviewer');
    expect(agentNames).toContain('writer');
    expect(agentNames).toHaveLength(8);
  });

  it('should parse agent frontmatter correctly', async () => {
    const plugin = await MaestriaPlugin(pluginInput);
    const config: Config = { agent: {} };
    await plugin.config?.(config);

    const builder = getAgentConfig(config, 'builder');
    expect(builder.mode).toBe('subagent');
    expect(typeof builder.description).toBe('string');
    const { prompt } = builder;
    expect(typeof prompt).toBe('string');
    if (typeof prompt !== 'string') {
      throw new TypeError('Expected builder prompt');
    }
    expect(prompt.trim()).not.toBe('');
    expect(builder.permission).toBeDefined();
  });

  it('preserves user model and variant overrides on maestria agent entries', async () => {
    const plugin = await MaestriaPlugin(pluginInput);
    const config: Config = {
      agent: {
        builder: { model: 'opencode-go/deepseek-v4-pro', variant: 'high' },
        reviewer: { temperature: 0.1 },
      },
    };
    await plugin.config?.(config);

    const builder = getAgentConfig(config, 'builder');
    const reviewer = getAgentConfig(config, 'reviewer');
    expect(builder.model).toBe('opencode-go/deepseek-v4-pro');
    expect(builder.variant).toBe('high');
    expect(builder.mode).toBe('subagent');
    expect(typeof builder.prompt).toBe('string');
    expect(reviewer.temperature).toBe(0.1);
    expect(reviewer.mode).toBe('subagent');
  });

  it('keeps direct code tools denied to the orchestrator and permitted to builder', async () => {
    const plugin = await MaestriaPlugin(pluginInput);
    const config: Config = { agent: {} };
    await plugin.config?.(config);

    const orchestrator = getAgentConfig(config, 'orchestrator');
    const builder = getAgentConfig(config, 'builder');
    const orchestratorBash = orchestrator.permission?.bash;
    const builderBash = builder.permission?.bash;
    if (typeof orchestratorBash !== 'object' || orchestratorBash === null) {
      throw new Error('Expected orchestrator bash permissions');
    }
    if (typeof builderBash !== 'object' || builderBash === null) {
      throw new Error('Expected builder bash permissions');
    }

    expect(Object.entries(orchestrator.permission ?? {})).toContainEqual(['read', 'deny']);
    expect(orchestrator.permission?.edit).toBe('deny');
    expect(orchestratorBash['*']).toBe('deny');
    expect(Object.entries(builder.permission ?? {})).toContainEqual(['read', 'allow']);
    expect(builder.permission?.edit).toBe('allow');
    for (const command of ['tsc*', 'vitest*', 'vp*']) {
      expect(builderBash[command]).toBe('allow');
    }
    for (const command of ['pnpm*', 'npm*']) {
      expect(builderBash[command]).toBeUndefined();
    }
  });
});

describe('bundled skills', () => {
  it('registers the package skills directory once, after user skill paths', async () => {
    const plugin = await MaestriaPlugin(pluginInput);
    const config: SkillsConfig = { agent: {}, skills: { paths: ['~/my-skills'], urls: ['u'] } };
    await plugin.config?.(config);
    await plugin.config?.(config);

    const paths = config.skills?.paths ?? [];
    expect(paths).toHaveLength(2);
    expect(paths[0]).toBe('~/my-skills');
    expect(config.skills?.urls).toEqual(['u']);
    const bundled = paths[1] ?? '';
    expect(path.isAbsolute(bundled)).toBe(true);
    for (const skill of ['create-pull-request', 'docs-update']) {
      expect(existsSync(path.join(bundled, skill, 'SKILL.md'))).toBe(true);
    }
  });

  it('creates the skills config when the user has none', async () => {
    const plugin = await MaestriaPlugin(pluginInput);
    const config: SkillsConfig = { agent: {} };
    await plugin.config?.(config);

    expect(config.skills?.paths).toHaveLength(1);
  });
});
