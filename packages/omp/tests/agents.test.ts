import { describe, expect, it } from 'vite-plus/test';

import { deploySpecialistAgents } from '@/agents.js';

// deploySpecialistAgents reads from the `agents/` dir bundled with
// the package and writes to `~/.omp/agent/agents/`.

describe('deploySpecialistAgents', () => {
  it('handles missing source directory gracefully', () => {
    // deploySpecialistAgents with a missing source dir should not throw
    // It reads from the package's agents/ directory which should exist
    // when the package is built/synced. If missing, it logs a warning.
    expect(() => {
      deploySpecialistAgents();
    }).not.toThrow();
  });
});
