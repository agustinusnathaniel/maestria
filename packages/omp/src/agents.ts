import { deploySpecialistAgents as deployAgents } from '@maestria/shared-pi/agent-deployment';
import { homedir } from 'node:os';
import path from 'node:path';

const __dirname = import.meta.dirname;

const AGENTS_SRC = path.join(__dirname, '..', 'agents');

/**
 * Deploy bundled specialist agent .md files to the omp agents directory.
 *
 * Missing-source handling lives in the shared core (warn, deploy zero);
 * this shim only pins the omp deploy path.
 */
export const deploySpecialistAgents = (): void => {
  deployAgents(AGENTS_SRC, path.join(homedir(), '.omp', 'agent', 'agents'));
};
