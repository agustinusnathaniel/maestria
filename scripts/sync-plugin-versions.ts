/**
 * Sync plugin manifest versions from each package.json after `changeset version`.
 *
 * `changeset version` bumps the version in each package's package.json - the
 * single source of truth for the published artifact. Platform plugin manifests
 * that ship with those packages (and the Hermes Python _version.py used for
 * PyPI builds) must mirror that version so the published artifact never drifts
 * from the npm metadata.
 *
 * Run without arguments to sync every manifest. Run with --check to verify
 * parity without writing and exit non-zero on drift (wired into `pnpm check` /
 * `pnpm check:ci`). Exit codes: 0 success, 1 drift/error, 2 unknown arguments.
 *
 * Failure behavior is fail-closed: a missing package.json, a package.json
 * without a version or with a non-string/invalid semver version, or a
 * malformed manifest is reported as an ERROR and exits non-zero in BOTH
 * modes. A missing manifest is reported as DRIFT in --check mode and ERROR
 * in write mode - either way it exits non-zero. In --check mode, drift
 * between a manifest and its package.json also exits non-zero. Sync mode
 * repairs drift but never silently skips a required target.
 *
 * Write mode preflights every manifest for a target before touching the
 * filesystem: each manifest is read and its complete rewrite is computed in
 * memory first, so a missing, unwritable, malformed, or unrewritable
 * manifest (e.g. no top-level "version" field) aborts the whole target with
 * no writes - a drifted earlier sibling is never left updated when a later
 * sibling fails. Writes themselves are plain `writeFileSync` calls of the
 * staged content - there is no transaction or rollback layer.
 *
 * Format handling
 * ---------------
 * - JSON (package.json, plugin manifests): strict-parsed with `jsonc-parser`
 *   `parseTree` (comments and trailing commas rejected); the top-level
 *   `version` is read via `findNodeAtLocation`/`getNodeValue` and replaced
 *   with `modify`/`applyEdits`, preserving the rest of the document
 *   byte-for-byte. Known library limitation: jsonc-parser 3.x does not report
 *   duplicate keys (it silently keeps the last one). The manifests this tool
 *   manages are project-owned and never contain them.
 * - YAML (plugin.yaml): parsed and read with the `yaml` package
 *   (`parseDocument`), so quoted versions read as their semantic value. The
 *   write does `Document#set` + `toString`, preserving comments, quote style,
 *   and key order. Known library limitation: `toString` normalizes whitespace
 *   (multi-space alignment collapses to one space) and line endings (CRLF ->
 *   LF).
 * - Python (_version.py): a generated release artifact with canonical two-line
 *   content (docstring header + `__version__`). The version is read with a
 *   small regex and the file is regenerated canonically on write, exactly as
 *   the previous release helper did - no Python lexing or assignment parsing.
 *
 * Targets
 * -------
 * - @maestria/hermes       packages/hermes/package.json
 *                          -> src/maestria_hermes/_version.py
 *                          -> plugin.yaml
 * - @maestria/claude-code  packages/claude-code/package.json
 *                          -> .claude-plugin/plugin.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  applyEdits,
  findNodeAtLocation,
  getNodeValue,
  modify,
  parseTree,
  printParseErrorCode,
  type Node,
  type ParseError,
} from 'jsonc-parser';
import { parseDocument } from 'yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// SemVer 2.0.0 (https://semver.org): package.json versions are published as
// semver, so anything else is a release-pipeline bug and must fail loudly.
const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

// Hermes _version.py is a generated release artifact; the previous helper
// always rewrote it to this canonical two-line content.
const VERSION_PY_HEADER = '"""Package version -- single source of truth."""';

// (package dir, list of manifest paths relative to the package dir)
export type Target = [packageDir: string, manifests: string[]];

export const TARGETS: Target[] = [
  [
    path.join(ROOT, 'packages', 'hermes'),
    [path.join('src', 'maestria_hermes', '_version.py'), path.join('plugin.yaml')],
  ],
  [path.join(ROOT, 'packages', 'claude-code'), [path.join('.claude-plugin', 'plugin.json')]],
];

export function display(p: string): string {
  /** Return the repo-relative path when possible, else the path itself. */
  const rel = path.relative(ROOT, p);
  return rel === '' || rel.startsWith('..') ? p : rel;
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ---------------------------------------------------------------------------
// JSON (strict: package.json and plugin manifests are JSON, not JSONC)
// ---------------------------------------------------------------------------

/**
 * Parse a strict JSON document and return its parse tree, or throw.
 *
 * `parseTree` with `disallowComments` fails closed on malformed numbers,
 * trailing commas, unescaped control characters, trailing garbage after the
 * top-level value, comments, and any other syntax error anywhere in the
 * document (jsonc-parser rejects a `01` leading zero, and `allowTrailingComma`
 * defaults to false).
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
 * Return the value of the top-level `version` property, or null when absent.
 *
 * `findNodeAtLocation` matches only the top-level property, so a nested
 * `version` (e.g. inside `meta`) is never mistaken for it.
 */
function readJsonVersion(text: string): unknown {
  const tree = parseJsonTree(text);
  if (tree.type !== 'object') {
    throw new Error('top-level value is not a JSON object');
  }
  const node = findNodeAtLocation(tree, ['version']);
  return node === undefined ? null : getNodeValue(node);
}

/**
 * Rewrite the top-level `version` value, preserving the rest of the document.
 *
 * `modify`/`applyEdits` replace only the value span: key order, indentation,
 * spacing, and newlines are preserved byte-for-byte.
 */
function rewriteJsonVersion(text: string, version: string): string {
  parseJsonTree(text); // malformed JSON fails closed here
  if (readJsonVersion(text) === null) {
    throw new Error('no "version" field found');
  }
  return applyEdits(text, modify(text, ['version'], version, {}));
}

// ---------------------------------------------------------------------------
// YAML (plugin.yaml)
// ---------------------------------------------------------------------------

/**
 * Return the semantic value of the top-level `version` key, or null when it
 * is absent. Quoted versions read as their semantic value ("1.2.3" -> 1.2.3).
 */
function readYamlVersion(text: string): string | null {
  const doc = parseDocument(text);
  if (doc.errors.length > 0) {
    throw new Error(`invalid YAML: ${doc.errors[0].message.split('\n')[0]}`);
  }
  const value = doc.get('version') as string | number | bigint | boolean | null | undefined;
  return value === undefined || value === null ? null : String(value);
}

/**
 * Rewrite the top-level `version` key, preserving comments, quote style, and
 * key order via `Document#set`/`toString` (see the header for the whitespace
 * normalization caveat).
 */
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

// ---------------------------------------------------------------------------
// Python (_version.py)
// ---------------------------------------------------------------------------

/** Return the version from the canonical `__version__ = "..."` line, or null. */
function readPythonVersion(text: string): string | null {
  return text.match(/__version__\s*=\s*"([^"]+)"/)?.[1] ?? null;
}

/** The canonical two-line _version.py content for a version. */
function pythonVersionText(version: string): string {
  return `${VERSION_PY_HEADER}\n__version__ = "${version}"\n`;
}

// ---------------------------------------------------------------------------
// Manifest read/rewrite dispatch
// ---------------------------------------------------------------------------

/**
 * Return the version declared by a manifest, or null if undeclared.
 *
 * JSON manifests are strict-parsed (any syntax error fails closed) and only
 * the top-level `version` is read. YAML versions are read as their semantic
 * value via the `yaml` parser. Python manifests are read with a small regex
 * against the canonical generated format.
 */
export function readManifestVersion(p: string): unknown {
  const suffix = path.extname(p);
  const text = fs.readFileSync(p, 'utf-8');
  if (suffix === '.py') return readPythonVersion(text);
  if (suffix === '.yaml' || suffix === '.yml') return readYamlVersion(text);
  if (suffix === '.json') return readJsonVersion(text);
  throw new Error(`unsupported manifest format: ${suffix}`);
}

/**
 * Compute the rewritten text of a manifest with its version field set to
 * `version`.
 *
 * - JSON: the top-level `version` value span is replaced via jsonc-parser
 *   modify/applyEdits; key order, indentation, spacing, and newlines are
 *   preserved byte-for-byte.
 * - YAML: `Document#set` + `toString` preserve comments, quote style, and key
 *   order (whitespace/line endings normalize as the library does).
 * - Python: the file is regenerated to its canonical two-line content.
 */
export function computeManifestVersion(p: string, version: string): string {
  const suffix = path.extname(p);
  if (suffix === '.py') return pythonVersionText(version);
  if (suffix === '.yaml' || suffix === '.yml')
    return rewriteYamlVersion(fs.readFileSync(p, 'utf-8'), version);
  if (suffix === '.json') return rewriteJsonVersion(fs.readFileSync(p, 'utf-8'), version);
  throw new Error(`unsupported manifest format: ${suffix}`);
}

/** Format a manifest's current version for DRIFT reporting, mirroring Python's str(). */
function formatCurrent(current: unknown): string {
  if (current === null) return 'None';
  if (current === true) return 'True';
  if (current === false) return 'False';
  if (typeof current === 'string' || typeof current === 'number' || typeof current === 'bigint') {
    return String(current);
  }
  return JSON.stringify(current);
}

/**
 * Sync one package's manifests to its package.json version.
 *
 * Returns result lines:
 * - "OK: <path> (<version>)" / "OK: synced <path> to <version>"
 * - "DRIFT: <path> expected <a> found <b>" / "DRIFT: <path> not found" -
 *   fails only check mode (drift, or a required manifest missing)
 * - "ERROR: <detail>" - hard failure in both modes (missing package.json,
 *   missing/non-string/invalid semver version, malformed package.json or
 *   manifest, or unreadable/unwritable target; a missing manifest in write
 *   mode)
 *
 * Write mode preflights every manifest before touching the filesystem,
 * computing each rewrite in memory: a missing, unwritable, malformed, or
 * unrewritable manifest (e.g. no "version" field) aborts the writes for all
 * manifests in the package (a valid but drifted sibling is reported as
 * skipped ERROR rather than DRIFT). Writes are plain `writeFileSync` calls
 * of the staged content - no transaction layer.
 */
export function syncTarget(packageDir: string, manifests: string[], check: boolean): string[] {
  const pkgJson = path.join(packageDir, 'package.json');
  if (!fs.existsSync(pkgJson)) {
    return [`ERROR: required target ${display(pkgJson)} not found`];
  }

  let version: unknown;
  try {
    version = readJsonVersion(fs.readFileSync(pkgJson, 'utf-8'));
  } catch (err) {
    return [`ERROR: cannot read ${display(pkgJson)}: ${message(err)}`];
  }
  if (version === null) {
    return [`ERROR: no version field in ${display(pkgJson)}`];
  }
  if (typeof version !== 'string' || !version.trim()) {
    return [
      `ERROR: invalid version ${JSON.stringify(version)} in ${display(pkgJson)}: ` +
        'expected a non-empty string',
    ];
  }
  if (!SEMVER_RE.test(version)) {
    return [`ERROR: invalid semver version ${JSON.stringify(version)} in ${display(pkgJson)}`];
  }

  // Preflight: read every manifest and, in write mode, stage its complete
  // rewrite in memory before touching the filesystem. A missing, unreadable,
  // unwritable, malformed, or unrewritable manifest (e.g. no top-level
  // "version" field) aborts the whole target: no manifest is written, so a
  // drifted earlier sibling is never left updated when a later sibling
  // fails.
  interface Preflight {
    rel: string;
    path: string;
    current: unknown;
    /** Set when the manifest could not be read or is not writable. */
    readError?: string;
    /** Set when the write-mode rewrite could not be computed. */
    syncError?: string;
    /** Staged rewritten content; present when write mode would update. */
    updated?: string;
    missing?: boolean;
  }
  const preflight: Preflight[] = [];
  for (const manifest of manifests) {
    const manifestPath = path.join(packageDir, manifest);
    const rel = display(manifestPath);
    if (!fs.existsSync(manifestPath)) {
      preflight.push({ rel, path: manifestPath, current: null, missing: true });
      continue;
    }
    if (!check) {
      try {
        fs.accessSync(manifestPath, fs.constants.W_OK);
      } catch (err) {
        preflight.push({
          rel,
          path: manifestPath,
          current: null,
          syncError: `not writable: ${message(err)}`,
        });
        continue;
      }
    }
    try {
      const current = readManifestVersion(manifestPath);
      const entry: Preflight = { rel, path: manifestPath, current };
      if (!check && current !== version) {
        // Compute the full rewrite now so a failure (e.g. a missing
        // "version" field) is caught before any file in the target is
        // written.
        try {
          entry.updated = computeManifestVersion(manifestPath, version);
        } catch (err) {
          entry.syncError = message(err);
        }
      }
      preflight.push(entry);
    } catch (err) {
      preflight.push({ rel, path: manifestPath, current: null, readError: message(err) });
    }
  }

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
      // A sibling manifest failed preflight; leave this one untouched too so
      // the target is never partially updated. Write mode repairs drift, so
      // a refused repair is an ERROR, never a DRIFT line.
      results.push(
        `ERROR: skipped ${m.rel}: a sibling manifest failed preflight; no files were changed`,
      );
      continue;
    }
    try {
      // The rewrite was staged during preflight: every manifest reaching
      // this branch is drifted and unblocked, so `updated` is present.
      fs.writeFileSync(m.path, m.updated!, 'utf-8');
      results.push(`OK: synced ${m.rel} to ${version}`);
    } catch (err) {
      results.push(`ERROR: cannot sync ${m.rel}: ${message(err)}`);
    }
  }
  return results;
}

/**
 * Run the synchronizer. Returns the process exit code: 0 on success, 1 when
 * any target produced a DRIFT or ERROR line, 2 on unknown arguments.
 * `targets` defaults to the canonical TARGETS table and may be overridden by
 * tests.
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
