import { describe, it, expect } from 'vite-plus/test';
import { MaestriaPlugin } from '@/index.js';
import pkg from '../package.json' with { type: 'json' };

describe('plugin structure', () => {
  it('should have a valid package.json', () => {
    expect(pkg.name).toBe('@maestria/opencode');
    expect(pkg.type).toBe('module');
  });

  it('should export MaestriaPlugin', () => {
    expect(typeof MaestriaPlugin).toBe('function');
  });

  it('should load all 8 agents', async () => {
    const plugin = await MaestriaPlugin({} as never);
    const config = { agent: {} };
    await plugin.config?.(config);

    const agentNames = Object.keys(config.agent);
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
    const plugin = await MaestriaPlugin({} as never);
    const config = { agent: {} };
    await plugin.config?.(config);

    const agent = config.agent as Record<string, Record<string, unknown>>;
    const builder = agent.builder;
    expect(builder.mode).toBe('subagent');
    expect(typeof builder.description).toBe('string');
    expect(typeof builder.prompt).toBe('string');
    expect(builder.permission).toBeDefined();
  });

  it('preserves user model and variant overrides on maestria agent entries', async () => {
    const plugin = await MaestriaPlugin({} as never);
    const config = {
      agent: {
        builder: { model: 'opencode-go/deepseek-v4-pro', variant: 'high' },
        reviewer: { temperature: 0.1 },
      },
    };
    await plugin.config?.(config);

    const agent = config.agent as Record<string, Record<string, unknown>>;
    expect(agent.builder.model).toBe('opencode-go/deepseek-v4-pro');
    expect(agent.builder.variant).toBe('high');
    expect(agent.builder.mode).toBe('subagent');
    expect(typeof agent.builder.prompt).toBe('string');
    expect(agent.reviewer.temperature).toBe(0.1);
    expect(agent.reviewer.mode).toBe('subagent');
  });

  it('keeps mutation tools denied to the orchestrator while permitting read-only recon', async () => {
    const plugin = await MaestriaPlugin({} as never);
    const config = { agent: {} };
    await plugin.config?.(config);

    const agent = config.agent as Record<string, Record<string, any>>;
    // Orchestrator may read/search to route and verify, but never mutate.
    expect(agent.orchestrator.permission.read).toBe('allow');
    expect(agent.orchestrator.permission.grep).toBe('allow');
    expect(agent.orchestrator.permission.edit).toBe('deny');
    expect(agent.orchestrator.permission.bash['*']).toBe('deny');
    // Read-only bash allowed for recon; mutation-capable still denied.
    expect(agent.orchestrator.permission.bash['ls*']).toBe('allow');
    expect(agent.orchestrator.permission.bash['git status*']).toBe('allow');
    expect(agent.builder.permission.read).toBe('allow');
    expect(agent.builder.permission.edit).toBe('allow');
    for (const command of ['pnpm*', 'npm*', 'tsc*', 'vitest*', 'vp*']) {
      expect(agent.builder.permission.bash[command]).toBe('allow');
    }
    expect(agent.orchestrator.prompt).toContain(
      'code changes use `focused` and a permitted `@builder`',
    );
    expect(agent.orchestrator.prompt).not.toContain('direct execution where the host supports it');
  });
});
