import { describe, expect, it } from 'vite-plus/test';
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
  it('loads the 7 specialists with subagent mode, description, and prompt', () => {
    const agents = loadAgents();
    expect(Object.keys(agents).toSorted()).toEqual(SPECIALISTS);
    for (const name of SPECIALISTS) {
      expect(agents[name]?.mode, `"${name}".mode`).toBe('subagent');
      expect(agents[name]?.description.length, `"${name}".description`).toBeGreaterThan(0);
      expect(agents[name]?.prompt.length, `"${name}".prompt`).toBeGreaterThan(0);
      // Every agent ships a permission ruleset: a missing block would leave
      // the agent on the base policy silently, so fail loud here instead.
      expect(agents[name]?.permissions.length, `"${name}".permissions`).toBeGreaterThan(0);
    }
  });

  it('loadOrchestrator returns the orchestrator with mode all', () => {
    const orchestrator = loadOrchestrator();
    expect(orchestrator).not.toBeNull();
    expect(orchestrator?.name).toBe('orchestrator');
    expect(orchestrator?.mode).toBe('all');
    expect(orchestrator?.permissions.length, '"orchestrator".permissions').toBeGreaterThan(0);
  });
});
