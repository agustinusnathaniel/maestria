import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import type { ExtensionContext } from '@earendil-works/pi-coding-agent';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Source directory for bundled specialist agent files (synced from canonical) */
const AGENTS_SRC = join(__dirname, '..', 'agents');

/** Destination directory where pi-subagents discovers agent types */
const AGENTS_DEST = join(homedir(), '.pi', 'agent', 'agents');

const SPECIALIST_NAMES = [
  'adventurer',
  'architect',
  'builder',
  'diagnose',
  'planner',
  'reviewer',
  'writer',
] as const;

/**
 * Deploy bundled specialist agent .md files to the pi-subagents agents directory.
 *
 * pi-subagents discovers agent types from ~/.pi/agent/agents/*.md on every
 * registry.reload() call (which fires automatically on each tool invocation).
 * This function ensures the files are in place before the first subagent dispatch.
 *
 * Only creates files that don't already exist - never overwrites user-customized agents.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function deploySpecialistAgents(_ctx?: ExtensionContext): void {
  const srcDir = AGENTS_SRC;

  if (!existsSync(srcDir)) {
    console.warn('[maestria] Agents source directory not found:', srcDir);
    return;
  }

  // Ensure destination directory exists
  try {
    mkdirSync(AGENTS_DEST, { recursive: true });
  } catch {
    console.warn('[maestria] Could not create agents directory:', AGENTS_DEST);
    return;
  }

  let deployed = 0;
  for (const name of SPECIALIST_NAMES) {
    const srcFile = join(srcDir, `${name}.md`);
    const destFile = join(AGENTS_DEST, `${name}.md`);

    if (!existsSync(srcFile)) {
      console.warn(`[maestria] Agent source not found: ${name}.md`);
      continue;
    }

    // Never overwrite existing files - user may have customized them
    if (existsSync(destFile)) continue;

    try {
      const content = readFileSync(srcFile, 'utf-8');
      writeFileSync(destFile, content, 'utf-8');
      deployed++;
    } catch (err) {
      console.warn(`[maestria] Failed to deploy agent ${name}:`, err);
    }
  }

  if (deployed > 0) {
    console.log(`[maestria] Deployed ${deployed} specialist agents to ${AGENTS_DEST}`);
  }
}
