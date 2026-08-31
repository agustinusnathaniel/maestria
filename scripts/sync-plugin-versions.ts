/**
 * Sync plugin manifest versions from each package.json - the source of truth
 * after `changeset version` - into the manifests shipping with the package.
 *
 * No args syncs every manifest; `--check` verifies parity without writing and
 * exits non-zero on drift (wired into `pnpm check` / `pnpm check:ci`). Exit
 * codes: 0 success, 1 drift/error, 2 unknown arguments.
 *
 * Fail-closed: a missing or malformed package.json, invalid semver version,
 * or malformed manifest errors non-zero in both modes. A missing manifest is
 * DRIFT in check mode, ERROR in write mode.
 *
 * Write mode preflights/stages every manifest rewrite in memory before any
 * write, so a missing, unwritable, malformed, or unrewritable manifest (no
 * top-level "version") aborts the whole target - no partial updates. Writes
 * are plain `writeFileSync` of the staged content; no transaction layer.
 *
 * Format handling - edits are formatting-preserving:
 * - JSON: jsonc-parser `parseTree`/`modify`/`applyEdits` replace only the
 *   top-level version span; the rest of the document is preserved
 *   byte-for-byte. Limitation: jsonc-parser 3.x does not report duplicate
 *   keys (keeps the last); manifests are project-owned and never contain
 *   them.
 * - YAML: `yaml` `parseDocument`/`Document#set` preserve comments, quote
 *   style, and key order, and quoted versions read as their semantic value.
 *   Limitation: `toString` normalizes whitespace and line endings.
 * - Python (_version.py): a generated release artifact, regenerated
 *   canonically to two lines (docstring + `__version__`) on write, as the
 *   previous release helper did.
 *
 * Targets:
 * - @maestria/hermes       packages/hermes/package.json -> src/maestria_hermes/_version.py, plugin.yaml
 * - @maestria/claude-code  packages/claude-code/package.json -> .claude-plugin/plugin.json
 * - @maestria/codex        packages/codex/package.json -> .codex-plugin/plugin.json
 * - @maestria/cursor       packages/cursor/package.json -> .cursor-plugin/plugin.json
 * - @maestria/kimi-code    packages/kimi-code/package.json -> kimi.plugin.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  applyEdits,
  findNodeAtLocation,
  getNodeValue,
  modify,
  parseTree,
  printParseErrorCode,
} from 'jsonc-parser';
import type { Node, ParseError } from 'jsonc-parser';
import { parseDocument } from 'yaml';

const ROOT = path.resolve(import.meta.dirname, '..');

// Versions are published semver (https://semver.org); anything else is a pipeline bug.
const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/u;

// Canonical two-line _version.py content, matching the previous release helper.
const VERSION_PY_HEADER = '"""Package version -- single source of truth."""';

// (package dir, list of manifest paths relative to the package dir)
export type Target = [packageDir: string, manifests: string[]];

export const TARGETS: Target[] = [
  [
    path.join(ROOT, 'packages', 'hermes'),
    [path.join('src', 'maestria_hermes', '_version.py'), path.join('plugin.yaml')],
  ],
  [path.join(ROOT, 'packages', 'claude-code'), [path.join('.claude-plugin', 'plugin.json')]],
  [path.join(ROOT, 'packages', 'codex'), [path.join('.codex-plugin', 'plugin.json')]],
  [path.join(ROOT, 'packages', 'cursor'), [path.join('.cursor-plugin', 'plugin.json')]],
  [path.join(ROOT, 'packages', 'kimi-code'), [path.join('kimi.plugin.json')]],
];

export function display(p: string): string {
  /** Return the repo-relative path when possible, else the path itself. */
  const rel = path.relative(ROOT, p);
  return rel === '' || rel.startsWith('..') ? p : rel;
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// JSON: strict - package.json and plugin manifests are JSON, not JSONC
// ---------------------------------------------------------------------------

/**
 * Strict-parse a JSON document and return its parse tree, or throw.
 * `disallowComments` rejects comments, trailing commas, and any other syntax
 * error - fails closed.
 */
function parseJsonTree(text: string): Node {
  const errors: ParseError[] = [];
  const tree = parseTree(text, errors, { disallowComments: true });
  if (errors.length > 0) {
    throw new Error(`invalid JSON: ${printParseErrorCode(errors[0].error)}`);
  }
  if (tree === undefined) {
    throw new Error('invalid JSON: empty document');
  }
  return tree;
}

/**
 * Top-level `version` value, or null when absent. `findNodeAtLocation` only
 * matches the top-level property, so a nested `version` is never mistaken.
 */
function readJsonVersion(text: string): unknown {
  const tree = parseJsonTree(text);
  if (tree.type !== 'object') {
    throw new Error('top-level value is not a JSON object');
  }
  const node = findNodeAtLocation(tree, ['version']);
  return node === undefined ? null : getNodeValue(node);
}

/** Rewrite the top-level `version`, preserving the rest of the document byte-for-byte. */
function rewriteJsonVersion(text: string, version: string): string {
  parseJsonTree(text); // malformed JSON fails closed here
  if (readJsonVersion(text) === null) {
    throw new Error('no "version" field found');
  }
  return applyEdits(text, modify(text, ['version'], version, {}));
}

// YAML (plugin.yaml)
// ---------------------------------------------------------------------------

/** Semantic value of the top-level `version` key, or null when absent. */
function readYamlVersion(text: string): string | null {
  const doc = parseDocument(text);
  if (doc.errors.length > 0) {
    throw new Error(`invalid YAML: ${doc.errors[0].message.split('\n')[0]}`);
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: narrow from broader type via prior validation, safe string/boolean assertion
  const value = doc.get('version') as string | number | bigint | boolean | null | undefined;
  return value === undefined || value === null ? null : String(value);
}

/** Rewrite the top-level `version`, preserving comments, quote style, and key order. */
function rewriteYamlVersion(text: string, version: string): string {
  const doc = parseDocument(text);
  if (doc.errors.length > 0) {
    throw new Error(`invalid YAML: ${doc.errors[0].message.split('\n')[0]}`);
  }
  if (doc.get('version') === undefined) {
    throw new Error('no "version" field found');
  }
  doc.set('version', version);
  return doc.toString();
}

// Python (_version.py)
// ---------------------------------------------------------------------------

/** Return the version from the canonical `__version__ = "..."` line, or null. */
function readPythonVersion(text: string): string | null {
  return /__version__\s*=\s*"([^"]+)"/u.exec(text)?.[1] ?? null;
}

/** The canonical two-line _version.py content for a version. */
function pythonVersionText(version: string): string {
  return `${VERSION_PY_HEADER}\n__version__ = "${version}"\n`;
}

// Manifest read/rewrite dispatch
// ---------------------------------------------------------------------------

/** Version declared by a manifest, or null if undeclared (dispatches on extension). */
export function readManifestVersion(p: string): unknown {
  const suffix = path.extname(p);
  const text = fs.readFileSync(p, 'utf-8');
  if (suffix === '.py') {
    return readPythonVersion(text);
  }
  if (suffix === '.yaml' || suffix === '.yml') {
    return readYamlVersion(text);
  }
  if (suffix === '.json') {
    return readJsonVersion(text);
  }
  throw new Error(`unsupported manifest format: ${suffix}`);
}

/** Compute the rewritten manifest text with its version set (format-preserving, see header). */
export function computeManifestVersion(p: string, version: string): string {
  const suffix = path.extname(p);
  if (suffix === '.py') {
    return pythonVersionText(version);
  }
  if (suffix === '.yaml' || suffix === '.yml') {
    return rewriteYamlVersion(fs.readFileSync(p, 'utf-8'), version);
  }
  if (suffix === '.json') {
    return rewriteJsonVersion(fs.readFileSync(p, 'utf-8'), version);
  }
  throw new Error(`unsupported manifest format: ${suffix}`);
}

/** Format a manifest's current version for DRIFT reporting, mirroring Python's str(). */
function formatCurrent(current: unknown): string {
  if (current === null) {
    return 'None';
  }
  if (current === true) {
    return 'True';
  }
  if (current === false) {
    return 'False';
  }
  if (typeof current === 'string' || typeof current === 'number' || typeof current === 'bigint') {
    return String(current);
  }
  return JSON.stringify(current);
}

/**
 * Sync one package's manifests to its package.json version.
 *
 * Result lines: "OK: ...", "DRIFT: ..." (check mode only: drift, or a
 * required manifest missing), "ERROR: ..." (both modes: missing package.json,
 * invalid version, malformed/unreadable/unwritable manifest; a missing
 * manifest in write mode). Write mode preflights every manifest first - any
 * failure aborts the whole target with no writes (see header).
 */
function resolvePackageVersion(packageDir: string): { version?: string; error?: string } {
  const pkgJson = path.join(packageDir, 'package.json');
  if (!fs.existsSync(pkgJson)) {
    return { error: `ERROR: required target ${display(pkgJson)} not found` };
  }
  let version: unknown;
  try {
    version = readJsonVersion(fs.readFileSync(pkgJson, 'utf-8'));
  } catch (error) {
    return { error: `ERROR: cannot read ${display(pkgJson)}: ${message(error)}` };
  }
  if (version === null) {
    return { error: `ERROR: no version field in ${display(pkgJson)}` };
  }
  if (typeof version !== 'string' || !version.trim()) {
    return {
      error: `ERROR: invalid version ${JSON.stringify(version)} in ${display(pkgJson)}: expected a non-empty string`,
    };
  }
  if (!SEMVER_RE.test(version)) {
    return {
      error: `ERROR: invalid semver version ${JSON.stringify(version)} in ${display(pkgJson)}`,
    };
  }
  return { version };
}

export function syncTarget(packageDir: string, manifests: string[], check: boolean): string[] {
  const pkgResult = resolvePackageVersion(packageDir);
  if (pkgResult.error !== undefined && pkgResult.error !== null && pkgResult.error !== '') {
    return [pkgResult.error];
  }
  // oxlint-disable-next-line typescript/no-non-null-assertion -- SAFETY: early return on error guarantees version is defined
  const version = pkgResult.version!;

  const preflight = buildPreflight(packageDir, manifests, version, check);
  return collectSyncResults(preflight, version, check);
}

interface Preflight {
  rel: string;
  path: string;
  current: unknown;
  readError?: string;
  syncError?: string;
  updated?: string;
  missing?: boolean;
}

function buildPreflight(
  packageDir: string,
  manifests: string[],
  version: string,
  check: boolean,
): Preflight[] {
  const preflight: Preflight[] = [];
  for (const manifest of manifests) {
    const manifestPath = path.join(packageDir, manifest);
    const rel = display(manifestPath);
    if (!fs.existsSync(manifestPath)) {
      preflight.push({ current: null, missing: true, path: manifestPath, rel });
      continue;
    }
    if (!check) {
      try {
        fs.accessSync(manifestPath, fs.constants.W_OK);
      } catch (error) {
        preflight.push({
          current: null,
          path: manifestPath,
          rel,
          syncError: `not writable: ${message(error)}`,
        });
        continue;
      }
    }
    try {
      const current = readManifestVersion(manifestPath);
      const entry: Preflight = { current, path: manifestPath, rel };
      if (!check && current !== version) {
        try {
          entry.updated = computeManifestVersion(manifestPath, version);
        } catch (error) {
          entry.syncError = message(error);
        }
      }
      preflight.push(entry);
    } catch (error) {
      preflight.push({ current: null, path: manifestPath, readError: message(error), rel });
    }
  }
  return preflight;
}

function collectSyncResults(preflight: Preflight[], version: string, check: boolean): string[] {
  const blocked = preflight.some(
    (m) => m.missing === true || m.readError !== undefined || m.syncError !== undefined,
  );
  const results: string[] = [];
  for (const m of preflight) {
    if (m.missing === true) {
      results.push(`${check ? 'DRIFT' : 'ERROR'}: ${m.rel} not found`);
      continue;
    }
    if (m.readError !== undefined) {
      results.push(`ERROR: cannot read ${m.rel}: ${m.readError}`);
      continue;
    }
    if (m.syncError !== undefined) {
      results.push(`ERROR: cannot sync ${m.rel}: ${m.syncError}`);
      continue;
    }
    if (m.current === version) {
      results.push(`OK: ${m.rel} (${version})`);
      continue;
    }
    if (check) {
      results.push(`DRIFT: ${m.rel} expected ${version} found ${formatCurrent(m.current)}`);
      continue;
    }
    if (blocked) {
      results.push(
        `ERROR: skipped ${m.rel}: a sibling manifest failed preflight; no files were changed`,
      );
      continue;
    }
    try {
      // oxlint-disable-next-line typescript/no-non-null-assertion -- SAFETY: preflight guarantees updated is set when not blocked and version mismatch
      fs.writeFileSync(m.path, m.updated!, 'utf-8');
      results.push(`OK: synced ${m.rel} to ${version}`);
    } catch (error) {
      results.push(`ERROR: cannot sync ${m.rel}: ${message(error)}`);
    }
  }
  return results;
}

/**
 * Run the synchronizer. Returns the process exit code: 0 success, 1 any
 * DRIFT/ERROR, 2 unknown arguments. `targets` defaults to TARGETS and is
 * overridable by tests.
 */
export function main(args: string[] = process.argv.slice(2), targets: Target[] = TARGETS): number {
  let check = false;
  for (const arg of args) {
    if (arg === '--check') {
      check = true;
    } else {
      console.error(`unrecognized argument: ${arg}`);
      return 2;
    }
  }

  let hadError = false;
  for (const [packageDir, manifests] of targets) {
    const results = syncTarget(packageDir, manifests, check);
    for (const result of results) {
      console.log(result);
    }
    hadError ||= results.some((r) => r.startsWith('DRIFT') || r.startsWith('ERROR'));
  }

  if (hadError) {
    if (check) {
      console.log(
        '\nManifest versions out of sync - run: pnpm exec tsx scripts/sync-plugin-versions.ts',
      );
    } else {
      console.log('\nFailed to sync plugin manifest versions - fix the reported errors and retry');
    }
    return 1;
  }
  if (check) {
    console.log('\nAll plugin manifest versions are in sync');
  }
  return 0;
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  process.exitCode = main();
}
