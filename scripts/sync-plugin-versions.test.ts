import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { main, syncTarget, TARGETS } from './sync-plugin-versions.js';
import type { Target } from './sync-plugin-versions.js';

/**
 * Behavior-focused tests for scripts/sync-plugin-versions.ts.
 *
 * The synchronizer copies each package.json `version` into the JSON plugin
 * manifests that ship with it. These tests exercise the behavior release
 * automation depends on - parity checking, drift repair with formatting
 * preservation, and fail-closed handling of malformed or missing input -
 * against throwaway fixture trees under the OS temp dir. They never touch the
 * real repo manifests, the network, or release machinery.
 */

const tempDirs: string[] = [];

type JsonObject = Record<string, unknown>;

const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseJsonObject = (text: string): JsonObject => {
  const value: unknown = JSON.parse(text);
  if (!isJsonObject(value)) {
    throw new Error('expected a JSON object');
  }
  return value;
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { force: true, recursive: true });
  }
});

/** Create a throwaway fixture dir under the OS temp dir, removed after the test. */
const tempDir = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-plugin-'));
  tempDirs.push(dir);
  return dir;
};

/**
 * Create a fixture package dir.
 *
 * `manifests` maps relative manifest paths to their text; a `null` text
 * omits the file (so the synchronizer must report it missing). Returns the
 * package dir and the manifest paths as passed to `syncTarget`.
 */
const makePackage = (
  root: string,
  version: string | number | null,
  manifests: Record<string, string | null>,
): { pkg: string; manifestPaths: string[] } => {
  const pkg = path.join(root, 'pkg');
  fs.mkdirSync(pkg, { recursive: true });
  const pkgJson: Record<string, unknown> = { name: 'fixture-pkg' };
  if (version !== null) {
    pkgJson.version = version;
  }
  fs.writeFileSync(
    path.join(pkg, 'package.json'),
    `${JSON.stringify(pkgJson, null, 2)}\n`,
    'utf-8',
  );
  const manifestPaths: string[] = [];
  for (const [rel, text] of Object.entries(manifests)) {
    const p = path.join(pkg, rel);
    if (text !== null) {
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, text, 'utf-8');
    }
    manifestPaths.push(rel);
  }
  return { manifestPaths, pkg };
};

describe('syncTarget', () => {
  it('reports OK when in sync under --check and does not write', () => {
    const root = tempDir();
    const original = '{\n  "version": "1.2.3"\n}\n';
    const { pkg, manifestPaths } = makePackage(root, '1.2.3', { 'plugin.json': original });
    const results = syncTarget(pkg, manifestPaths, true);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatch(/^OK: /u);
    expect(results[0].endsWith('plugin.json (1.2.3)')).toBe(true);
    expect(fs.readFileSync(path.join(pkg, 'plugin.json'), 'utf-8')).toBe(original);
  });

  it('reports drift under --check and does not write', () => {
    const root = tempDir();
    const { pkg, manifestPaths } = makePackage(root, '1.2.3', {
      'plugin.json': '{\n  "version": "1.2.2"\n}\n',
    });
    const results = syncTarget(pkg, manifestPaths, true);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatch(/^DRIFT: /u);
    expect(results[0]).toContain('expected 1.2.3 found 1.2.2');
    expect(fs.readFileSync(path.join(pkg, 'plugin.json'), 'utf-8')).toContain('"version": "1.2.2"');
  });

  it('updates a drifted JSON manifest in write mode, preserving formatting byte-for-byte', () => {
    const original =
      '{\n  "name": "maestria",\n  "version": "0.1.0",\n  "description": "test"\n}\n';
    const root = tempDir();
    const { pkg, manifestPaths } = makePackage(root, '0.2.0', { 'plugin.json': original });
    const results = syncTarget(pkg, manifestPaths, false);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatch(/^OK: synced /u);
    expect(results[0].endsWith('to 0.2.0')).toBe(true);
    expect(fs.readFileSync(path.join(pkg, 'plugin.json'), 'utf-8')).toBe(
      '{\n  "name": "maestria",\n  "version": "0.2.0",\n  "description": "test"\n}\n',
    );
  });

  it('reads and updates only the top-level version, not a nested one', () => {
    const nestedFirst = '{\n  "meta": {"version": "9.9.9"},\n  "version": "1.0.0"\n}\n';
    const root = tempDir();
    const { pkg, manifestPaths } = makePackage(root, '2.0.0', { 'plugin.json': nestedFirst });
    const checkResults = syncTarget(pkg, manifestPaths, true);
    expect(checkResults[0]).toContain('expected 2.0.0 found 1.0.0');
    syncTarget(pkg, manifestPaths, false);
    const manifest = parseJsonObject(fs.readFileSync(path.join(pkg, 'plugin.json'), 'utf-8'));
    expect(manifest.version).toBe('2.0.0');
    const meta = isJsonObject(manifest.meta) ? manifest.meta : undefined;
    expect(meta?.version).toBe('9.9.9');
  });

  it('rejects malformed JSON in check and write without writing', () => {
    // Trailing comma, leading-zero number, and trailing garbage all fail
    // closed even though the version field itself is fine.
    const malformed = [
      '{\n  "version": "1.2.3",\n  "count": 1,\n}\n',
      '{\n  "version": "1.2.3",\n  "count": 01\n}\n',
      '{"version": "1.2.3"} trailing\n',
    ];
    for (const text of malformed) {
      const root = tempDir();
      const { pkg, manifestPaths } = makePackage(root, '1.2.3', { 'plugin.json': text });
      for (const check of [true, false]) {
        const results = syncTarget(pkg, manifestPaths, check);
        expect(results).toHaveLength(1);
        expect(results[0]).toMatch(/^ERROR: /u);
      }
      expect(fs.readFileSync(path.join(pkg, 'plugin.json'), 'utf-8')).toBe(text);
    }
  });

  it('fails on missing package.json in check and write', () => {
    const root = tempDir();
    const pkg = path.join(root, 'pkg');
    fs.mkdirSync(pkg, { recursive: true });
    for (const check of [true, false]) {
      const results = syncTarget(pkg, [], check);
      expect(results).toHaveLength(1);
      expect(results[0]).toMatch(/^ERROR: /u);
      expect(results[0]).toContain('not found');
    }
  });

  it('fails on missing, non-string, or invalid-semver package version', () => {
    for (const version of [null, 42, '', 'not-semver'] as const) {
      const root = tempDir();
      const { pkg } = makePackage(root, version, {});
      for (const check of [true, false]) {
        const results = syncTarget(pkg, [], check);
        expect(results).toHaveLength(1);
        expect(results[0]).toMatch(/^ERROR: /u);
      }
    }
  });

  it('reports a missing manifest as drift in check and error in write', () => {
    const root = tempDir();
    const { pkg, manifestPaths } = makePackage(root, '1.2.3', { 'plugin.json': null });
    const checkResults = syncTarget(pkg, manifestPaths, true);
    expect(checkResults[0]).toMatch(/^DRIFT: /u);
    expect(checkResults[0]).toContain('not found');
    const writeResults = syncTarget(pkg, manifestPaths, false);
    expect(writeResults[0]).toMatch(/^ERROR: /u);
    expect(writeResults[0]).toContain('not found');
  });

  it('never partially writes when a sibling manifest is malformed or missing', () => {
    // Preflight runs before any write: a malformed or missing sibling means
    // the valid drifted manifest is left untouched (reported as skipped
    // ERROR, never DRIFT) and no file is modified.
    const drifted = '{\n  "version": "1.2.2"\n}\n';
    const malformed = '{ nope';
    for (const sibling of [
      { 'a.json': drifted, 'b.json': malformed },
      { 'a.json': drifted, 'b.json': null },
    ]) {
      const root = tempDir();
      const { pkg, manifestPaths } = makePackage(root, '1.2.3', sibling);
      const results = syncTarget(pkg, manifestPaths, false);
      expect(results).toHaveLength(2);
      expect(results.filter((r) => r.startsWith('ERROR: '))).toHaveLength(2);
      expect(results.some((r) => r.startsWith('DRIFT'))).toBe(false);
      expect(results.some((r) => r.includes('skipped'))).toBe(true);
      expect(fs.readFileSync(path.join(pkg, 'a.json'), 'utf-8')).toBe(drifted);
    }
  });

  it('leaves a drifted first manifest untouched when a later JSON manifest lacks version', () => {
    // Write mode computes every rewrite during preflight. A manifest with
    // valid syntax but no top-level "version" field only fails while
    // computing its rewrite - before staging, the valid drifted sibling was
    // written first and the target was left partially updated. Neither file
    // may change; the valid sibling is reported as skipped ERROR, not DRIFT.
    const drifted = '{\n  "version": "1.2.2"\n}\n';
    const noVersion = '{\n  "name": "maestria"\n}\n';
    const root = tempDir();
    const { pkg, manifestPaths } = makePackage(root, '1.2.3', {
      'a.json': drifted,
      'b.json': noVersion,
    });
    const results = syncTarget(pkg, manifestPaths, false);
    expect(results).toHaveLength(2);
    expect(results[0]).toMatch(/^ERROR: /u);
    expect(results[0]).toContain('skipped');
    expect(results[1]).toContain('no "version" field found');
    expect(results.some((r) => r.startsWith('DRIFT'))).toBe(false);
    expect(fs.readFileSync(path.join(pkg, 'a.json'), 'utf-8')).toBe(drifted);
    expect(fs.readFileSync(path.join(pkg, 'b.json'), 'utf-8')).toBe(noVersion);
  });
});

/** Run main() against fixture targets. */
const runMain = (pkg: string, manifests: string[], ...args: string[]): number => {
  const targets: Target[] = [[pkg, manifests]];
  return main(args, targets);
};

describe('main wiring', () => {
  it('tracks every root manifest for version sync', () => {
    expect(TARGETS).toHaveLength(1);
    expect(TARGETS[0]?.[1]).toEqual([
      'plugin.json',
      '.claude-plugin/plugin.json',
      '.codex-plugin/plugin.json',
      '.cursor-plugin/plugin.json',
      '.devin-plugin/plugin.json',
      '.zcode-plugin/plugin.json',
      'kimi.plugin.json',
    ]);
  });

  it('returns 0 when in sync under --check', () => {
    const root = tempDir();
    const { pkg, manifestPaths } = makePackage(root, '1.2.3', {
      'plugin.json': '{\n  "version": "1.2.3"\n}\n',
    });
    expect(runMain(pkg, manifestPaths, '--check')).toBe(0);
  });

  it('returns 1 on drift under --check and on write-mode errors, 2 on unknown args', () => {
    const root = tempDir();
    const { pkg, manifestPaths } = makePackage(root, '1.2.3', {
      'plugin.json': '{\n  "version": "1.2.2"\n}\n',
    });
    expect(runMain(pkg, manifestPaths, '--check')).toBe(1);
    expect(runMain(pkg, manifestPaths, '--bogus')).toBe(2);

    const emptyPkg = path.join(tempDir(), 'pkg');
    fs.mkdirSync(emptyPkg, { recursive: true });
    expect(runMain(emptyPkg, [])).toBe(1);
  });

  it('syncs JSON manifests across targets in write mode (integration)', () => {
    const root = tempDir();
    const firstPkg = path.join(root, 'first');
    const secondPkg = path.join(root, 'second');
    for (const dir of [firstPkg, secondPkg]) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(firstPkg, 'package.json'),
      `${JSON.stringify({ name: '@maestria/first', version: '0.1.13' }, null, 2)}\n`,
      'utf-8',
    );
    fs.writeFileSync(
      path.join(secondPkg, 'package.json'),
      `${JSON.stringify({ name: '@maestria/second', version: '0.2.0' }, null, 2)}\n`,
      'utf-8',
    );
    fs.writeFileSync(
      path.join(firstPkg, 'plugin.json'),
      '{\n  "name": "maestria",\n  "version": "0.1.12"\n}\n',
      'utf-8',
    );
    fs.mkdirSync(path.join(secondPkg, '.claude-plugin'), { recursive: true });
    fs.writeFileSync(
      path.join(secondPkg, '.claude-plugin', 'plugin.json'),
      '{\n  "name": "maestria",\n  "version": "0.1.0"\n}\n',
      'utf-8',
    );

    const targets: Target[] = [
      [firstPkg, ['plugin.json']],
      [secondPkg, ['.claude-plugin/plugin.json']],
    ];
    expect(main([], targets)).toBe(0);

    const firstManifest = parseJsonObject(
      fs.readFileSync(path.join(firstPkg, 'plugin.json'), 'utf-8'),
    );
    expect(firstManifest.version).toBe('0.1.13');
    const secondManifest = parseJsonObject(
      fs.readFileSync(path.join(secondPkg, '.claude-plugin', 'plugin.json'), 'utf-8'),
    );
    expect(secondManifest.version).toBe('0.2.0');

    // After the sync everything is in parity: --check exits 0.
    expect(main(['--check'], targets)).toBe(0);
  });
});
