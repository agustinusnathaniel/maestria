/**
 * Shared agent deployment logic for Maestria platform packages.
 *
 * Both @maestria/omp and @maestria/pi deploy specialist agent .md files
 * to their respective platform agent directories. This module eliminates
 * the duplication between the two packages.
 *
 * @module
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ALLOWED_AGENTS } from './subagent-utils.js';

/**
 * Deploy bundled specialist agent .md files to the given destination directory.
 *
 * Only creates files that don't already exist - never overwrites user-customized agents.
 *
 * @param agentsSrc  - Path to the source directory containing specialist .md files
 * @param agentsDest - Absolute path to the platform's agents destination directory
 *                     (e.g. `join(homedir(), '.omp', 'agent', 'agents')`)
 * @returns The number of agents newly deployed
 */
export function deploySpecialistAgents(agentsSrc: string, agentsDest: string): number {
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
    const srcFile = join(agentsSrc, `${name}.md`);
    const destFile = join(agentsDest, `${name}.md`);

    if (!existsSync(srcFile)) {
      console.warn(`[maestria] Agent source not found: ${name}.md`);
      continue;
    }

    if (existsSync(destFile)) {
      continue;
    }

    try {
      const content = readFileSync(srcFile, 'utf-8');
      writeFileSync(destFile, content, 'utf-8');
      deployed++;
    } catch (error) {
      console.warn(`[maestria] Failed to deploy agent ${name}:`, error);
    }
  }

  if (deployed > 0) {
    console.log(`[maestria] Deployed ${deployed} specialist agents to ${agentsDest}`);
  }

  return deployed;
}
