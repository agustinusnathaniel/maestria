import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { deploySpecialistAgents as deployAgents } from '@maestria/shared-pi/agent-deployment';

const __filename = import.meta.filename;
const __dirname = import.meta.dirname;

const AGENTS_SRC = join(__dirname, '..', 'agents');

/**
 * Deploy bundled specialist agent .md files to the omp agents directory.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function deploySpecialistAgents(_ctx?: unknown): void {
  if (!existsSync(AGENTS_SRC)) {
    console.warn('[maestria] Agents source directory not found:', AGENTS_SRC);
    return;
  }
  deployAgents(AGENTS_SRC, join(homedir(), '.omp', 'agent', 'agents'));
}
