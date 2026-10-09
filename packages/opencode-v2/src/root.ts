import path from 'node:path';

export const PACKAGE_ROOT = path.join(import.meta.dirname, '..');
export const AGENTS_DIR = path.join(PACKAGE_ROOT, 'agents');
export const COMMANDS_DIR = path.join(AGENTS_DIR, 'commands');
export const RULES_PATH = path.join(PACKAGE_ROOT, 'rules', 'AGENTS.md');

// Bundled skills (synced from core via sync.config.ts). Agents, commands,
// and rules resolve the same way: the loader never reaches outside the
// package, so installs carry their skills with them.
export const SKILLS_DIR = path.join(PACKAGE_ROOT, 'skills');
