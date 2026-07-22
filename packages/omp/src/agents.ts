import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import type { ExtensionContext } from '@oh-my-pi/pi-coding-agent';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Source directory for bundled specialist agent files (synced from canonical) */
const AGENTS_SRC = join(__dirname, '..', 'agents');

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
 * Deploy bundled specialist agent .md files to the omp agents directory.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function deploySpecialistAgents(_ctx?: ExtensionContext): void {
  const AGENTS_DEST = join(homedir(), '.omp', 'agent', 'agents');
  const srcDir = AGENTS_SRC;

  if (!existsSync(srcDir)) {
    console.warn('[maestria] Agents source directory not found:', srcDir);
    return;
  }

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
