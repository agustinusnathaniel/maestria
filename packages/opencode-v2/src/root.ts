import path from 'node:path';

const __filename = import.meta.filename;
const __dirname = import.meta.dirname;

export const PACKAGE_ROOT = path.join(__dirname, '..');
export const AGENTS_DIR = path.join(PACKAGE_ROOT, 'agents');
export const COMMANDS_DIR = path.join(AGENTS_DIR, 'commands');
export const RULES_PATH = path.join(PACKAGE_ROOT, 'rules', 'AGENTS.md');

// Bundled skills dir (future sync target; currently empty - see CORE_SKILLS_DIR fallback)
export const SKILLS_DIR = path.join(PACKAGE_ROOT, 'skills');
// Canonical skills source - used as fallback when SKILLS_DIR is empty/not synced
export const CORE_SKILLS_DIR = path.join(PACKAGE_ROOT, '../core/agent-directives/skills');

// NOTE: AGENTS_DIR/COMMANDS_DIR stay rooted at PACKAGE_ROOT (bundled plugin
// defaults). Project-level shadowing via `ctx.location` would layer on top,
// not replace them.
