import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

/** The specialist agent types maestria supports. */
export const ALLOWED_AGENTS = ['reviewer'] as const;

const AGENTS_SRC = path.join(import.meta.dirname, '..', 'agents');

/**
 * Deploy bundled specialist agent .md files to the pi-subagents agents directory, which
 * pi-subagents rereads on every `registry.reload()` (each tool invocation). Only creates files
 * that don't already exist: never overwrites user-customized agents.
 *
 * @returns The number of agents newly deployed
 */
export const deploySpecialistAgents = (
  agentsSrc = AGENTS_SRC,
  agentsDest = path.join(homedir(), '.pi', 'agent', 'agents'),
): number => {
  if (!existsSync(agentsSrc)) {
    console.warn('[maestria] Agents source directory not found:', agentsSrc);
    return 0;
  }

  try {
    mkdirSync(agentsDest, { recursive: true });
  } catch {
    console.warn('[maestria] Could not create agents directory:', agentsDest);
    return 0;
  }

  let deployed = 0;
  for (const name of ALLOWED_AGENTS) {
    const srcFile = path.join(agentsSrc, `${name}.md`);
    const destFile = path.join(agentsDest, `${name}.md`);

    if (!existsSync(srcFile)) {
      console.warn(`[maestria] Agent source not found: ${name}.md`);
      continue;
    }

    if (existsSync(destFile)) {
      continue;
    }

    try {
      writeFileSync(destFile, readFileSync(srcFile, 'utf-8'), 'utf-8');
      deployed += 1;
    } catch (error) {
      console.warn(`[maestria] Failed to deploy agent ${name}:`, error);
    }
  }

  if (deployed > 0) {
    console.log(`[maestria] Deployed ${deployed} specialist agents to ${agentsDest}`);
  }

  return deployed;
};
