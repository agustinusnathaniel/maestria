import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const PACKAGE_ROOT = join(__dirname, '..');
export const AGENTS_DIR = join(PACKAGE_ROOT, 'agents');
export const COMMANDS_DIR = join(AGENTS_DIR, 'commands');
export const RULES_DIR = join(PACKAGE_ROOT, 'rules');
export const RULES_PATH = join(RULES_DIR, 'AGENTS.md');
