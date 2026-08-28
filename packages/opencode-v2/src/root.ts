import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const PACKAGE_ROOT = join(__dirname, '..');
export const AGENTS_DIR = join(PACKAGE_ROOT, 'agents');
export const COMMANDS_DIR = join(AGENTS_DIR, 'commands');
export const RULES_DIR = join(PACKAGE_ROOT, 'rules');
export const RULES_PATH = join(RULES_DIR, 'AGENTS.md');

// Bundled skills dir (future sync target; currently empty - see CORE_SKILLS_DIR fallback)
export const SKILLS_DIR = join(PACKAGE_ROOT, 'skills');
// Canonical skills source - used as fallback when SKILLS_DIR is empty/not synced
export const CORE_SKILLS_DIR = join(PACKAGE_ROOT, '../core/agent-directives/skills');

// NOTE: Location-aware override - PACKAGE_ROOT is correct for the bundled plugin (agents/skills live
// inside the package). `ctx.location` (workspace/project directory) is available for future project-level
// overrides where a user shadows an agent/skill in their repo, but host-specific resolution should be
// layered on top of the bundled defaults, not replace them. Keep AGENTS_DIR/COMMANDS_DIR rooted at
// PACKAGE_ROOT; add a future `resolveAgentDir(ctx)` helper if project shadowing is desired.
