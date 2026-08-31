import { deploySpecialistAgents as deployAgents } from '@maestria/shared-pi/agent-deployment';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const __filename = import.meta.filename;
const __dirname = import.meta.dirname;

const AGENTS_SRC = path.join(__dirname, '..', 'agents');

/**
 * Deploy bundled specialist agent .md files to the omp agents directory.
 */
export const deploySpecialistAgents = (_ctx?: unknown): void => {
  if (!existsSync(AGENTS_SRC)) {
    console.warn('[maestria] Agents source directory not found:', AGENTS_SRC);
    return;
  }
  deployAgents(AGENTS_SRC, path.join(homedir(), '.omp', 'agent', 'agents'));
};
