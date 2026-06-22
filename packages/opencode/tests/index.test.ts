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
});
