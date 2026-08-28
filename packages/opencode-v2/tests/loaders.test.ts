import { describe, it, expect } from 'vite-plus/test';
import { loadAgents, loadOrchestrator } from '../src/agents.js';

const SPECIALISTS = [
  'adventurer',
  'architect',
  'builder',
  'diagnose',
  'planner',
  'reviewer',
  'writer',
];

describe('agent loaders (real generated agents/ dir)', () => {
  it('loadAgents excludes the orchestrator', () => {
    const agents = loadAgents();
    expect(Object.keys(agents).sort()).toEqual(SPECIALISTS);
    expect(agents['orchestrator']).toBeUndefined();
  });

  it('every specialist has mode subagent', () => {
    const agents = loadAgents();
    for (const name of SPECIALISTS) {
      expect(agents[name], `specialist "${name}" should exist`).toBeDefined();
      expect(agents[name].mode).toBe('subagent');
    }
  });

  it('loadOrchestrator returns the orchestrator with mode all', () => {
    const orchestrator = loadOrchestrator();
    expect(orchestrator).not.toBeNull();
    expect(orchestrator?.name).toBe('orchestrator');
    expect(orchestrator?.mode).toBe('all');
  });

  it('parsed agents carry a non-empty description and prompt body', () => {
    const agents = loadAgents();
    for (const [name, config] of Object.entries(agents)) {
      expect(config.description.length, `${name}.description`).toBeGreaterThan(0);
      expect(config.prompt.length, `${name}.prompt`).toBeGreaterThan(0);
    }
  });
});
