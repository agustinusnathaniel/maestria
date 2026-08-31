import { deploySpecialistAgents as deployAgents } from '@maestria/shared-pi/agent-deployment';
import { homedir } from 'node:os';
import path from 'node:path';

const __dirname = import.meta.dirname;

const AGENTS_SRC = path.join(__dirname, '..', 'agents');

/**
 * Deploy bundled specialist agent .md files to the pi-subagents agents directory.
 *
 * pi-subagents discovers agent types from ~/.pi/agent/agents/*.md on every
 * registry.reload() call (which fires automatically on each tool invocation).
 * This function ensures the files are in place before the first subagent dispatch.
 *
 * Only creates files that don't already exist - never overwrites user-customized agents.
 */
export const deploySpecialistAgents = (_ctx?: unknown): void => {
  deployAgents(AGENTS_SRC, path.join(homedir(), '.pi', 'agent', 'agents'));
};
