#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { transformWithOxc } from 'vite-plus';
import { normalizeLineEndings } from '../packages/core/scripts/lib/transforms.js';

// Plugin hooks run as plain Node scripts on each host, outside any package install, so the shared
// policy ships as one bundled, dependency-free module beside them. The source stays split into
// one module per job (see packages/shared/hook-policy/src/index.ts for the contract); this script
// inlines the relative imports and re-exports only the entry's public names.
const SOURCE_DIR = 'packages/shared/hook-policy/src';
const ENTRY = 'packages/shared/hook-policy/src/index.ts';
const TARGET = 'packages/agent-plugins/hooks/lib/policy.mjs';
export const POLICY_NOTICE = `// Generated from ${SOURCE_DIR} by scripts/sync-hook-policy.ts. Do not edit directly.`;

const ANY_IMPORT = /^\s*import\b/mu;
const IMPORT_STATEMENT = /^\s*import\b[\s\S]*?\bfrom\s+['"](?<specifier>[^'"]+)['"]\s*;?/gmu;
const EXPORT_FROM =
  /^\s*export\s+(?<typeOnly>type\s+)?\{(?<names>[^}]*)\}\s+from\s+['"](?<specifier>\.\/[^'"]+)['"]/u;
const EXPORT_DECLARATION = /^\s*export\s+/u;

/** Absolute source path for a `./x.js` specifier imported from `importerDir` (relative to SOURCE_DIR). */
const specifierToFile = (repoRoot: string, importerDir: string, specifier: string): string => {
  const base = specifier.endsWith('.js') ? specifier.slice(0, -'.js'.length) : specifier;
  const absolute = path.join(
    repoRoot,
    SOURCE_DIR,
    path.normalize(path.join(importerDir, `${base}.ts`)),
  );
  const root = path.join(repoRoot, SOURCE_DIR);
  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) {
    throw new Error(`sync-hook-policy: import outside ${SOURCE_DIR}: ${specifier}`);
  }
  return absolute;
};

/** Absolute paths of the relative modules `source` imports, or throws. */
const importedFiles = (repoRoot: string, importerDir: string, source: string): string[] => {
  const files: string[] = [];
  for (const match of source.matchAll(new RegExp(IMPORT_STATEMENT.source, 'gmu'))) {
    const specifier = match.groups?.specifier;
    if (specifier === undefined || (!specifier.startsWith('./') && !specifier.startsWith('../'))) {
      throw new Error(`sync-hook-policy: only relative imports are allowed: ${match[0].trim()}`);
    }
    files.push(specifierToFile(repoRoot, importerDir, specifier));
  }
  if (ANY_IMPORT.test(source.replaceAll(new RegExp(IMPORT_STATEMENT.source, 'gmu'), ''))) {
    throw new Error('sync-hook-policy: unparsable import (side-effect imports are not supported)');
  }
  return files;
};

/** `source` with every import statement removed. */
const stripImports = (source: string): string =>
  source.replaceAll(new RegExp(IMPORT_STATEMENT.source, 'gmu'), '');

const parseEntry = (
  repoRoot: string,
  source: string,
): { publicNames: string[]; deps: string[] } => {
  const publicNames: string[] = [];
  const deps: string[] = [];
  for (const line of source.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('//')) {
      continue;
    }
    const match = EXPORT_FROM.exec(line);
    if (match === null) {
      throw new Error(`sync-hook-policy: entry supports only named re-exports: ${trimmed}`);
    }
    const { typeOnly, names = '', specifier = '' } = match.groups ?? {};
    if (typeOnly === undefined) {
      publicNames.push(
        ...names.split(',').map((name) => {
          const alias = name.trim().split(/\s+as\s+/u);
          return alias.at(-1)?.trim() ?? name.trim();
        }),
      );
    }
    deps.push(specifierToFile(repoRoot, '.', specifier));
  }
  return { deps, publicNames };
};

const dirOf = (repoRoot: string, absolute: string): string =>
  path.dirname(path.relative(path.join(repoRoot, SOURCE_DIR), absolute));

export const bundleSources = (repoRoot: string): { code: string; publicNames: string[] } => {
  const entrySource = normalizeLineEndings(fs.readFileSync(path.join(repoRoot, ENTRY), 'utf-8'));
  const { deps, publicNames } = parseEntry(repoRoot, entrySource);
  const ordered: string[] = [];
  const visited = new Set<string>();
  const visit = (absolute: string, stack: string[]): void => {
    if (stack.includes(absolute)) {
      throw new Error(`sync-hook-policy: circular import: ${absolute}`);
    }
    if (visited.has(absolute)) {
      return;
    }
    visited.add(absolute);
    const source = normalizeLineEndings(fs.readFileSync(absolute, 'utf-8'));
    for (const dep of importedFiles(repoRoot, dirOf(repoRoot, absolute), source)) {
      visit(dep, [...stack, absolute]);
    }
    ordered.push(absolute);
  };
  for (const dep of deps) {
    visit(dep, []);
  }
  const parts: string[] = [];
  const declared = new Map<string, string>();
  for (const absolute of ordered) {
    const relative = path.relative(repoRoot, absolute);
    const source = stripImports(normalizeLineEndings(fs.readFileSync(absolute, 'utf-8')));
    if (ANY_IMPORT.test(source)) {
      throw new Error(`sync-hook-policy: unparsable import in ${relative}`);
    }
    const body: string[] = [];
    for (const line of source.split('\n')) {
      if (/^\s*export\s+default\b/u.test(line)) {
        throw new Error(`sync-hook-policy: default exports are not supported: ${line.trim()}`);
      }
      if (/^\s*export\s*\{/u.test(line) || /^\s*export\b.*\bfrom\s+['"]/u.test(line)) {
        throw new Error(`sync-hook-policy: re-exports only live in the entry: ${line.trim()}`);
      }
      // Every declaration ships without `export`; the entry's public names are
      // re-exported once at the end, so the artifact surface matches the entry.
      const stripped = line.replace(EXPORT_DECLARATION, '');
      const declaration = /^(?:const|let|var|function|class)\s+(?<name>\w+)/u.exec(stripped);
      if (declaration?.groups !== undefined) {
        const owner = declared.get(declaration.groups.name);
        if (owner !== undefined) {
          throw new Error(
            `sync-hook-policy: duplicate declaration ${declaration.groups.name} in ${relative} and ${owner}; value names must be unique across policy modules`,
          );
        }
        declared.set(declaration.groups.name, relative);
      }
      body.push(stripped);
    }
    parts.push(`// ----- ${relative} -----\n${body.join('\n').trim()}`);
  }
  parts.push(`export { ${publicNames.join(', ')} };`);
  return { code: `${parts.join('\n\n')}\n`, publicNames };
};

export const hookPolicyModule = async (repoRoot: string): Promise<string> => {
  const { code } = bundleSources(repoRoot);
  if (/^\s*import\s/mu.test(code) || /\bimport\s*\(/u.test(code)) {
    throw new Error(`${SOURCE_DIR} must bundle to an import-free standalone hook module`);
  }
  const { code: transpiled } = await transformWithOxc(code, ENTRY, { lang: 'ts' });
  return `${POLICY_NOTICE}\n${transpiled.trim()}\n`;
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
