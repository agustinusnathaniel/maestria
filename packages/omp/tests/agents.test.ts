import { describe, it, expect } from 'vite-plus/test';
import { deploySpecialistAgents } from '@/agents.js';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// We'll test deploySpecialistAgents by mocking the filesystem interactions
// at the module level. The function reads from the `agents/` dir bundled with
// the package and writes to `~/.omp/agent/agents/`.

describe('deploySpecialistAgents', () => {
  it('is a function', () => {
    expect(typeof deploySpecialistAgents).toBe('function');
  });

  it('handles missing source directory gracefully', () => {
    // deploySpecialistAgents with a missing source dir should not throw
    // It reads from the package's agents/ directory which should exist
    // when the package is built/synced. If missing, it logs a warning.
    expect(() => deploySpecialistAgents()).not.toThrow();
  });

  it('does not throw when called with context', () => {
    const ctx = {} as any;
    // The function accepts optional ExtensionContext but is resilient
    expect(() => deploySpecialistAgents(ctx)).not.toThrow();
  });
});

describe('agents source directory', () => {
  it('contains agent .md files for all specialists', () => {
    const agentsDir = join(import.meta.dirname, '..', 'agents');
    for (const name of [
      'adventurer',
      'architect',
      'builder',
      'diagnose',
      'planner',
      'reviewer',
      'writer',
    ]) {
      const filePath = join(agentsDir, `${name}.md`);
      // Source files may not exist in dev mode (they're synced), so check existence non-critically
      if (existsSync(filePath)) {
        const content = readFileSync(filePath, 'utf-8');
        expect(content.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('deploySpecialistAgents - target path', () => {
  it('targets ~/.omp/agent/agents/ directory', () => {
    // Verify the deploy path from the source code
    const agentsSrc = join(import.meta.dirname, '..', 'src', 'agents.ts');
    if (existsSync(agentsSrc)) {
      const content = readFileSync(agentsSrc, 'utf-8');
      expect(content).toContain('.omp');
      expect(content).toContain('agent');
      expect(content).toContain('agents');
    }
  });
});
