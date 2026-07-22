import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const PACKAGE_ROOT = resolve(__dirname, '..');
export const AGENTS_DIR = join(PACKAGE_ROOT, 'agents');
export const COMMANDS_DIR = join(PACKAGE_ROOT, 'agents', 'commands');
export const RULES_PATH = join(PACKAGE_ROOT, 'rules', 'AGENTS.md');
