#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { transformWithOxc } from 'vite-plus';
import { normalizeLineEndings } from '../packages/core/scripts/lib/transforms.js';

// Plugin hooks run as plain Node scripts on each host, outside any package install, so the shared
// policy ships as one transpiled, dependency-free module beside them.
const SOURCE = 'packages/shared/hook-policy/src/index.ts';
const TARGET = 'packages/agent-plugins/hooks/lib/policy.mjs';
export const POLICY_NOTICE = `// Generated from ${SOURCE} by scripts/sync-hook-policy.ts. Do not edit directly.`;

export const hookPolicyModule = async (repoRoot: string): Promise<string> => {
  const source = normalizeLineEndings(fs.readFileSync(path.join(repoRoot, SOURCE), 'utf-8'));
  if (/^\s*import\s/mu.test(source)) {
    throw new Error(`${SOURCE} must stay import-free to ship as a standalone hook module`);
  }
  const { code } = await transformWithOxc(source, SOURCE, { lang: 'ts' });
  return `${POLICY_NOTICE}\n${code.trim()}\n`;
};

/** Returns the target path when it was (or, in check mode, would be) rewritten. */
export const syncHookPolicy = async (repoRoot: string, check = false): Promise<string[]> => {
  const content = await hookPolicyModule(repoRoot);
  const target = path.join(repoRoot, TARGET);
  if (fs.existsSync(target) && fs.readFileSync(target, 'utf-8') === content) {
    return [];
  }
  if (!check) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf-8');
  }
  return [TARGET];
};

export const main = async (
  args: string[],
  repoRoot = path.resolve(import.meta.dirname, '..'),
): Promise<number> => {
  if (args.length > 1 || (args.length === 1 && !['--check', '--write'].includes(args[0]))) {
    console.error('Usage: sync-hook-policy.ts [--check|--write]');
    return 2;
  }
  try {
    const check = args[0] === '--check';
    const changes = await syncHookPolicy(repoRoot, check);
    for (const relative of changes) {
      console.log(`${check ? 'DRIFT' : 'SYNC'}: ${relative}`);
    }
    return check && changes.length > 0 ? 1 : 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 2;
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  process.exitCode = await main(process.argv.slice(2));
}
