import { homedir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vite-plus/test';

import { deploySpecialistAgents } from '@/agents.js';

const deployAgents = vi.hoisted(() => vi.fn<(src: string, dest: string) => number>());

// The deployer is mocked so this stays a wiring assertion: the shim's only
// contract is which two paths it hands over, and the real one writes to `~/.omp`.
vi.mock('@maestria/shared-pi/agent-deployment', () => ({ deploySpecialistAgents: deployAgents }));

describe('omp specialist agent deployment', () => {
  it('targets the omp agents directory', () => {
    deploySpecialistAgents();

    expect(deployAgents).toHaveBeenCalledWith(
      path.join(import.meta.dirname, '..', 'agents'),
      path.join(homedir(), '.omp', 'agent', 'agents'),
    );
  });
});
