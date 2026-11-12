#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { build, normalizePath } from 'vite-plus';
import type { Plugin } from 'vite-plus';
import { normalizeLineEndings } from '../packages/core/scripts/lib/transforms.js';

// Plugin hooks run as plain Node scripts on each host, so the shared policy ships as one
// bundled, dependency-free module. This script bundles the entry with the vite-plus build API;
// the scope guard below keeps imports inside the policy source tree (see index.ts contract).
const SOURCE_DIR = 'packages/shared/hook-policy/src';
const ENTRY = 'packages/shared/hook-policy/src/index.ts';
const TARGET = 'packages/agent-plugins/hooks/lib/policy.mjs';
export const POLICY_NOTICE = `// Generated from ${SOURCE_DIR} by scripts/sync-hook-policy.ts. Do not edit directly.`;

const scopePlugin = (repoRoot: string): Plugin => {
  const sourceRoot = normalizePath(fs.realpathSync(path.resolve(repoRoot, SOURCE_DIR)));
  return {
    enforce: 'pre',
    name: 'sync-hook-policy-scope',
    async resolveId(source, importer, options) {
      if (options.kind === 'dynamic-import') {
        throw new Error(`sync-hook-policy: dynamic imports are not supported: ${source}`);
      }
      if (importer !== undefined && !source.startsWith('./') && !source.startsWith('../')) {
        throw new Error(`sync-hook-policy: only relative imports are allowed: ${source}`);
      }
      const resolved = await this.resolve(source, importer, { skipSelf: true });
      if (
        resolved === null ||
        resolved.external !== false ||
        !normalizePath(resolved.id).startsWith(`${sourceRoot}/`)
      ) {
        throw new Error(`sync-hook-policy: import outside ${SOURCE_DIR}: ${source}`);
      }
      return resolved;
    },
  };
};

export const hookPolicyModule = async (repoRoot: string): Promise<string> => {
  const entry = path.join(repoRoot, ENTRY);
  const result = await build({
    build: {
      lib: { entry, fileName: 'policy', formats: ['es'] },
      minify: false,
      rolldownOptions: { cwd: repoRoot },
      target: 'es2022',
      write: false,
    },
    configFile: false,
    envDir: false,
    logLevel: 'silent',
    plugins: [scopePlugin(repoRoot)],
    publicDir: false,
    root: repoRoot,
  });
  const outputs = Array.isArray(result) ? result : [result];
  const [single] = outputs;
  if (outputs.length !== 1 || single === undefined || !('output' in single)) {
    throw new Error('sync-hook-policy: expected exactly one bundle');
  }
  if (!Array.isArray(single.output) || single.output.length !== 1) {
    throw new Error('sync-hook-policy: expected exactly one chunk');
  }
  const [chunk] = single.output;
  if (chunk === undefined || chunk.type !== 'chunk') {
    throw new Error('sync-hook-policy: expected exactly one chunk');
  }
  if (chunk.imports.length > 0 || chunk.dynamicImports.length > 0) {
    throw new Error(`${SOURCE_DIR} must bundle to an import-free standalone hook module`);
  }
  const code = normalizeLineEndings(chunk.code);
  if (/^\s*import\s/mu.test(code) || /\bimport\s*\(/u.test(code)) {
    throw new Error(`${SOURCE_DIR} must bundle to an import-free standalone hook module`);
  }
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
