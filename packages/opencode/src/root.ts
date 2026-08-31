import path from 'node:path';

const __dirname = import.meta.dirname;
export const PACKAGE_ROOT = path.resolve(__dirname, '..');
export const AGENTS_DIR = path.join(PACKAGE_ROOT, 'agents');
export const COMMANDS_DIR = path.join(PACKAGE_ROOT, 'agents', 'commands');
export const RULES_PATH = path.join(PACKAGE_ROOT, 'rules', 'AGENTS.md');
