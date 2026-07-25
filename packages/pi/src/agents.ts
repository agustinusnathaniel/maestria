import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deploySpecialistAgents as deployAgents } from '@maestria/shared-pi/agent-deployment';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const AGENTS_SRC = join(__dirname, '..', 'agents');

/**
 * Deploy bundled specialist agent .md files to the pi-subagents agents directory.
 *
 * pi-subagents discovers agent types from ~/.pi/agent/agents/*.md on every
 * registry.reload() call (which fires automatically on each tool invocation).
 * This function ensures the files are in place before the first subagent dispatch.
 *
 * Only creates files that don't already exist — never overwrites user-customized agents.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function deploySpecialistAgents(_ctx?: unknown): void {
  deployAgents(AGENTS_SRC, join(homedir(), '.pi', 'agent', 'agents'));
}
