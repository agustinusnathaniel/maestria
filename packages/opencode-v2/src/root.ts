import path from 'node:path';

const __filename = import.meta.filename;
const __dirname = import.meta.dirname;

export const PACKAGE_ROOT = path.join(__dirname, '..');
export const AGENTS_DIR = path.join(PACKAGE_ROOT, 'agents');
export const COMMANDS_DIR = path.join(AGENTS_DIR, 'commands');
export const RULES_PATH = path.join(PACKAGE_ROOT, 'rules', 'AGENTS.md');

// Canonical skills source: sync emits no skills dir and the package ships
// none (see sync.config.ts), so skills resolve to core at runtime.
// AGENTS_DIR/COMMANDS_DIR stay rooted at PACKAGE_ROOT (bundled defaults;
// project shadowing via `ctx.location` would layer on top).
export const CORE_SKILLS_DIR = path.join(PACKAGE_ROOT, '../core/agent-directives/skills');
