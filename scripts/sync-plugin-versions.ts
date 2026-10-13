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
 * Format handling - edits are formatting-preserving: jsonc-parser
 * `parseTree`/`modify`/`applyEdits` replace only the top-level version span;
 * the rest of the document is preserved byte-for-byte. Limitation:
 * jsonc-parser 3.x does not report duplicate keys (keeps the last);
 * manifests are project-owned and never contain them.
 *
 * Targets:
 * - @maestria/agent-plugins -> root manifests
 */

import {
  applyEdits,
  findNodeAtLocation,
  getNodeValue,
  modify,
  parseTree,
  printParseErrorCode,
} from 'jsonc-parser';
import type { Node, ParseError } from 'jsonc-parser';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');

// Versions are published semver (https://semver.org); anything else is a pipeline bug.
const SEMVER_RE =
  /^(?<major>0|[1-9]\d*)\.(?<minor>0|[1-9]\d*)\.(?<patch>0|[1-9]\d*)(?:-(?<prerelease>(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+(?<build>[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/u;

// (package dir, list of manifest paths relative to the package dir)
export type Target = [packageDir: string, manifests: string[]];

export const TARGETS: Target[] = [
  [
    path.join(ROOT, 'packages', 'agent-plugins'),
    [
      'plugin.json',
      '.claude-plugin/plugin.json',
      '.codex-plugin/plugin.json',
      '.cursor-plugin/plugin.json',
      '.devin-plugin/plugin.json',
      '.zcode-plugin/plugin.json',
      'kimi.plugin.json',
    ],
  ],
];

export const display = (p: string): string => {
  /** Return the repo-relative path when possible, else the path itself. */
  const rel = path.relative(ROOT, p);
  return rel === '' || rel.startsWith('..') ? p : rel;
};

const message = (err: unknown): string => (err instanceof Error ? err.message : String(err));

// JSON: strict - package.json and plugin manifests are JSON, not JSONC
// ---------------------------------------------------------------------------

/**
 * Strict-parse a JSON document and return its parse tree, or throw.
 * `disallowComments` rejects comments, trailing commas, and any other syntax
 * error - fails closed.
 */
const parseJsonTree = (text: string): Node => {
  const errors: ParseError[] = [];
  const tree = parseTree(text, errors, { disallowComments: true });
  if (errors.length > 0) {
    throw new Error(`invalid JSON: ${printParseErrorCode(errors[0].error)}`);
  }
  if (tree === undefined) {
    throw new Error('invalid JSON: empty document');
  }
  return tree;
};

/**
 * Top-level `version` value, or null when absent. `findNodeAtLocation` only
 * matches the top-level property, so a nested `version` is never mistaken.
 */
const readJsonVersion = (text: string): unknown => {
  const tree = parseJsonTree(text);
  if (tree.type !== 'object') {
    throw new Error('top-level value is not a JSON object');
  }
  const node = findNodeAtLocation(tree, ['version']);
  if (node === undefined) {
    return null;
  }
  const value: unknown = getNodeValue(node);
  return value;
};

/** Rewrite the top-level `version`, preserving the rest of the document byte-for-byte. */
const rewriteJsonVersion = (text: string, version: string): string => {
  // Malformed JSON fails closed here.
  parseJsonTree(text);
  if (readJsonVersion(text) === null) {
    throw new Error('no "version" field found');
  }
  return applyEdits(text, modify(text, ['version'], version, {}));
};

/** Drift display for a manifest's current version; strings print bare, as in the version field. */
const formatCurrent = (current: unknown): string =>
  typeof current === 'string' ? current : (JSON.stringify(current) ?? 'undefined');

type PackageVersionResult = { error: string; kind: 'error' } | { kind: 'success'; version: string };

const resolvePackageVersion = (packageDir: string): PackageVersionResult => {
  const pkgJson = path.join(packageDir, 'package.json');
  if (!fs.existsSync(pkgJson)) {
    return { error: `ERROR: required target ${display(pkgJson)} not found`, kind: 'error' };
  }
  let version: unknown;
  try {
    version = readJsonVersion(fs.readFileSync(pkgJson, 'utf-8'));
  } catch (error) {
    return { error: `ERROR: cannot read ${display(pkgJson)}: ${message(error)}`, kind: 'error' };
  }
  if (version === null) {
    return { error: `ERROR: no version field in ${display(pkgJson)}`, kind: 'error' };
  }
  if (typeof version !== 'string' || !version.trim()) {
    return {
      error: `ERROR: invalid version ${JSON.stringify(version)} in ${display(pkgJson)}: expected a non-empty string`,
      kind: 'error',
    };
  }
  if (!SEMVER_RE.test(version)) {
    return {
      error: `ERROR: invalid semver version ${JSON.stringify(version)} in ${display(pkgJson)}`,
      kind: 'error',
    };
  }
  return { kind: 'success', version };
};

interface Preflight {
  rel: string;
  path: string;
  current: unknown;
  readError?: string;
  syncError?: string;
  updated?: string;
  missing?: boolean;
}

const buildPreflight = (
  packageDir: string,
  manifests: string[],
  version: string,
  check: boolean,
): Preflight[] => {
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
      const text = fs.readFileSync(manifestPath, 'utf-8');
      const current = readJsonVersion(text);
      const entry: Preflight = { current, path: manifestPath, rel };
      if (!check && current !== version) {
        try {
          entry.updated = rewriteJsonVersion(text, version);
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
};

const collectSyncResults = (preflight: Preflight[], version: string, check: boolean): string[] => {
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
      if (m.updated === undefined) {
        results.push(`ERROR: cannot sync ${m.rel}: rewrite was not staged`);
        continue;
      }
      fs.writeFileSync(m.path, m.updated, 'utf-8');
      results.push(`OK: synced ${m.rel} to ${version}`);
    } catch (error) {
      results.push(`ERROR: cannot sync ${m.rel}: ${message(error)}`);
    }
  }
  return results;
};

export const syncTarget = (packageDir: string, manifests: string[], check: boolean): string[] => {
  const pkgResult = resolvePackageVersion(packageDir);
  if (pkgResult.kind === 'error') {
    return [pkgResult.error];
  }

  const preflight = buildPreflight(packageDir, manifests, pkgResult.version, check);
  return collectSyncResults(preflight, pkgResult.version, check);
};

/**
 * Run the synchronizer. Returns the process exit code: 0 success, 1 any
 * DRIFT/ERROR, 2 unknown arguments. `targets` defaults to TARGETS and is
 * overridable by tests.
 */
export const main = (
  args: string[] = process.argv.slice(2),
  targets: Target[] = TARGETS,
): number => {
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
};

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  process.exitCode = main();
}
