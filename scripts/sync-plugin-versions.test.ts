import { describe, it, expect, afterEach } from 'vite-plus/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { main, syncTarget, type Target } from './sync-plugin-versions.js';

/**
 * Behavior-focused tests for scripts/sync-plugin-versions.ts.
 *
 * The synchronizer copies each package.json `version` into the platform
 * plugin manifests that ship with it (Hermes `_version.py` + `plugin.yaml`,
 * Claude Code `plugin.json`). These tests exercise the behavior release
 * automation depends on - parity checking, drift repair with formatting
 * preservation, and fail-closed handling of malformed or missing input -
 * against throwaway fixture trees under the OS temp dir. They never touch the
 * real repo manifests, the network, or release machinery.
 */

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/** Create a throwaway fixture dir under the OS temp dir, removed after the test. */
function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-plugin-'));
  tempDirs.push(dir);
  return dir;
}

/**
 * Create a fixture package dir.
 *
 * `manifests` maps relative manifest paths to their text; a `null` text
 * omits the file (so the synchronizer must report it missing). Returns the
 * package dir and the manifest paths as passed to `syncTarget`.
 */
function makePackage(
  root: string,
  version: string | number | null,
  manifests: Record<string, string | null>,
): { pkg: string; manifestPaths: string[] } {
  const pkg = path.join(root, 'pkg');
  fs.mkdirSync(pkg, { recursive: true });
  const pkgJson: Record<string, unknown> = { name: 'fixture-pkg' };
  if (version !== null) {
    pkgJson.version = version;
  }
  fs.writeFileSync(
    path.join(pkg, 'package.json'),
    JSON.stringify(pkgJson, null, 2) + '\n',
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
  return { pkg, manifestPaths };
}

describe('syncTarget', () => {
  it('reports OK when in sync under --check and does not write', () => {
    const root = tempDir();
    const original = '{\n  "version": "1.2.3"\n}\n';
    const { pkg, manifestPaths } = makePackage(root, '1.2.3', { 'plugin.json': original });
    const results = syncTarget(pkg, manifestPaths, true);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatch(/^OK: /);
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
    expect(results[0]).toMatch(/^DRIFT: /);
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
    expect(results[0]).toMatch(/^OK: synced /);
    expect(results[0].endsWith('to 0.2.0')).toBe(true);
    expect(fs.readFileSync(path.join(pkg, 'plugin.json'), 'utf-8')).toBe(
      '{\n  "name": "maestria",\n  "version": "0.2.0",\n' + '  "description": "test"\n}\n',
    );
  });

  it('reads and updates only the top-level version, not a nested one', () => {
    const nestedFirst = '{\n  "meta": {"version": "9.9.9"},\n  "version": "1.0.0"\n}\n';
    const root = tempDir();
    const { pkg, manifestPaths } = makePackage(root, '2.0.0', { 'plugin.json': nestedFirst });
    const checkResults = syncTarget(pkg, manifestPaths, true);
    expect(checkResults[0]).toContain('expected 2.0.0 found 1.0.0');
    syncTarget(pkg, manifestPaths, false);
    const manifest = JSON.parse(fs.readFileSync(path.join(pkg, 'plugin.json'), 'utf-8'));
    expect(manifest.version).toBe('2.0.0');
    expect(manifest.meta.version).toBe('9.9.9');
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
        expect(results[0]).toMatch(/^ERROR: /);
        expect(results[0]).not.toMatch(/^DRIFT: /);
      }
      expect(fs.readFileSync(path.join(pkg, 'plugin.json'), 'utf-8')).toBe(text);
    }
  });

  it('rejects a malformed YAML manifest in check and write without writing', () => {
    const malformed = 'name: x\nversion: [1,2,\n';
    const root = tempDir();
    const { pkg, manifestPaths } = makePackage(root, '1.2.3', { 'plugin.yaml': malformed });
    for (const check of [true, false]) {
      const results = syncTarget(pkg, manifestPaths, check);
      expect(results).toHaveLength(1);
      expect(results[0]).toMatch(/^ERROR: /);
    }
    expect(fs.readFileSync(path.join(pkg, 'plugin.yaml'), 'utf-8')).toBe(malformed);
  });

  it('reads quoted YAML versions as semantic values and preserves quote style and comments', () => {
    // The DRIFT report shows the semantic value without quotes; the update
    // keeps the original quote style and inline comment (the yaml library
    // normalizes whitespace, e.g. multi-space alignment and CRLF -> LF).
    for (const quote of ['"', "'"] as const) {
      const root = tempDir();
      const pluginYaml =
        `name: maestria-hermes\nversion: ${quote}0.1.12${quote}  # release version\r\n` +
        'provides_tools:\n  - opencode_route\n';
      const { pkg, manifestPaths } = makePackage(root, '0.1.13', { 'plugin.yaml': pluginYaml });
      const checkResults = syncTarget(pkg, manifestPaths, true);
      expect(checkResults[0]).toContain('expected 0.1.13 found 0.1.12');
      syncTarget(pkg, manifestPaths, false);
      expect(fs.readFileSync(path.join(pkg, 'plugin.yaml'), 'utf-8')).toBe(
        `name: maestria-hermes\nversion: ${quote}0.1.13${quote} # release version\n` +
          'provides_tools:\n  - opencode_route\n',
      );
    }
  });

  it('regenerates Hermes _version.py canonically on update', () => {
    const root = tempDir();
    const { pkg, manifestPaths } = makePackage(root, '0.1.13', {
      'src/maestria_hermes/_version.py':
        '#!/usr/bin/env python3\n"""Package version -- single source of truth."""\n' +
        '__version__ = "0.1.12"\n',
    });
    const results = syncTarget(pkg, manifestPaths, false);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatch(/^OK: synced /);
    expect(fs.readFileSync(path.join(pkg, 'src/maestria_hermes/_version.py'), 'utf-8')).toBe(
      '"""Package version -- single source of truth."""\n__version__ = "0.1.13"\n',
    );
  });

  it('fails on missing package.json in check and write', () => {
    const root = tempDir();
    const pkg = path.join(root, 'pkg');
    fs.mkdirSync(pkg, { recursive: true });
    for (const check of [true, false]) {
      const results = syncTarget(pkg, [], check);
      expect(results).toHaveLength(1);
      expect(results[0]).toMatch(/^ERROR: /);
      expect(results[0]).toContain('not found');
    }
  });

  it('fails on missing, non-string, or invalid-semver package version', () => {
    for (const version of [null, 42, '', 'not-semver'] as const) {
      const root = tempDir();
      const { pkg } = makePackage(root, version as string | number | null, {});
      for (const check of [true, false]) {
        const results = syncTarget(pkg, [], check);
        expect(results).toHaveLength(1);
        expect(results[0]).toMatch(/^ERROR: /);
      }
    }
  });

  it('reports a missing manifest as drift in check and error in write', () => {
    const root = tempDir();
    const { pkg, manifestPaths } = makePackage(root, '1.2.3', { 'plugin.json': null });
    const checkResults = syncTarget(pkg, manifestPaths, true);
    expect(checkResults[0]).toMatch(/^DRIFT: /);
    expect(checkResults[0]).toContain('not found');
    const writeResults = syncTarget(pkg, manifestPaths, false);
    expect(writeResults[0]).toMatch(/^ERROR: /);
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
    expect(results[0]).toMatch(/^ERROR: /);
    expect(results[0]).toContain('skipped');
    expect(results[1]).toContain('no "version" field found');
    expect(results.some((r) => r.startsWith('DRIFT'))).toBe(false);
    expect(fs.readFileSync(path.join(pkg, 'a.json'), 'utf-8')).toBe(drifted);
    expect(fs.readFileSync(path.join(pkg, 'b.json'), 'utf-8')).toBe(noVersion);
  });

  it('leaves a drifted first manifest untouched when a later YAML manifest lacks version', () => {
    const drifted = '{\n  "version": "1.2.2"\n}\n';
    const noVersion = 'name: maestria-hermes\nprovides_tools:\n  - opencode_route\n';
    const root = tempDir();
    const { pkg, manifestPaths } = makePackage(root, '1.2.3', {
      'a.json': drifted,
      'plugin.yaml': noVersion,
    });
    const results = syncTarget(pkg, manifestPaths, false);
    expect(results).toHaveLength(2);
    expect(results[0]).toMatch(/^ERROR: /);
    expect(results[0]).toContain('skipped');
    expect(results[1]).toContain('no "version" field found');
    expect(results.some((r) => r.startsWith('DRIFT'))).toBe(false);
    expect(fs.readFileSync(path.join(pkg, 'a.json'), 'utf-8')).toBe(drifted);
    expect(fs.readFileSync(path.join(pkg, 'plugin.yaml'), 'utf-8')).toBe(noVersion);
  });
});

describe('main wiring', () => {
  /** Run main() against fixture targets. */
  function runMain(pkg: string, manifests: string[], ...args: string[]): number {
    const targets: Target[] = [[pkg, manifests]];
    return main(args, targets);
  }

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

  it('syncs Hermes and Claude target manifests in write mode (integration)', () => {
    const root = tempDir();
    const hermesPkg = path.join(root, 'hermes');
    const claudePkg = path.join(root, 'claude-code');
    for (const dir of [hermesPkg, claudePkg]) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(hermesPkg, 'package.json'),
      JSON.stringify({ name: '@maestria/hermes', version: '0.1.13' }, null, 2) + '\n',
      'utf-8',
    );
    fs.writeFileSync(
      path.join(claudePkg, 'package.json'),
      JSON.stringify({ name: '@maestria/claude-code', version: '0.2.0' }, null, 2) + '\n',
      'utf-8',
    );
    fs.mkdirSync(path.join(hermesPkg, 'src', 'maestria_hermes'), { recursive: true });
    fs.writeFileSync(
      path.join(hermesPkg, 'src', 'maestria_hermes', '_version.py'),
      '"""Package version -- single source of truth."""\n__version__ = "0.1.12"\n',
      'utf-8',
    );
    fs.writeFileSync(
      path.join(hermesPkg, 'plugin.yaml'),
      'name: maestria-hermes\nversion: 0.1.12\ndescription: test\n',
      'utf-8',
    );
    fs.mkdirSync(path.join(claudePkg, '.claude-plugin'), { recursive: true });
    fs.writeFileSync(
      path.join(claudePkg, '.claude-plugin', 'plugin.json'),
      '{\n  "name": "maestria",\n  "version": "0.1.0"\n}\n',
      'utf-8',
    );

    const targets: Target[] = [
      [hermesPkg, ['src/maestria_hermes/_version.py', 'plugin.yaml']],
      [claudePkg, ['.claude-plugin/plugin.json']],
    ];
    expect(main([], targets)).toBe(0);

    expect(
      fs.readFileSync(path.join(hermesPkg, 'src', 'maestria_hermes', '_version.py'), 'utf-8'),
    ).toBe('"""Package version -- single source of truth."""\n__version__ = "0.1.13"\n');
    expect(fs.readFileSync(path.join(hermesPkg, 'plugin.yaml'), 'utf-8')).toContain(
      'version: 0.1.13',
    );
    const claudeManifest = JSON.parse(
      fs.readFileSync(path.join(claudePkg, '.claude-plugin', 'plugin.json'), 'utf-8'),
    );
    expect(claudeManifest.version).toBe('0.2.0');

    // After the sync everything is in parity: --check exits 0.
    expect(main(['--check'], targets)).toBe(0);
  });
});
