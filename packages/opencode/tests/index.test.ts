import type { Config } from '@opencode-ai/plugin';
import { describe, expect, it } from 'vite-plus/test';

import pkg from '../package.json' with { type: 'json' };
import { pluginInput } from './helpers.js';

import { MaestriaPlugin } from '@/index.js';

type AgentConfig = NonNullable<NonNullable<Config['agent']>[string]>;

const getAgentConfig = (config: Config, name: string): AgentConfig => {
  const agent = config.agent?.[name];
  if (agent === undefined) {
    throw new Error(`Expected agent config for ${name}`);
  }
  return agent;
};

describe('plugin structure', () => {
  it('should have a valid package.json', () => {
    expect(pkg.name).toBe('@maestria/opencode');
    expect(pkg.type).toBe('module');
  });

  it('should export MaestriaPlugin', () => {
    expect(typeof MaestriaPlugin).toBe('function');
  });

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
    for (const command of ['pnpm*', 'npm*', 'tsc*', 'vitest*', 'vp*']) {
      expect(builderBash[command]).toBe('allow');
    }
  });
});
