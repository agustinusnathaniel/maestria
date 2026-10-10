import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { syncConsolidatedPlugin } from '../../../scripts/sync-consolidated-plugin.js';

const repoRoot = path.resolve(import.meta.dirname, '../../..');
const temporaryRoots: string[] = [];

const fixture = (): string => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maestria-plugin-assembly-'));
  temporaryRoots.push(root);
  fs.cpSync(
    path.join(repoRoot, 'packages/agent-plugins'),
    path.join(root, 'packages/agent-plugins'),
    {
      filter: (source) => !source.includes(`${path.sep}node_modules`),
      recursive: true,
    },
  );
  return root;
};

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

describe('consolidated plugin assembly', () => {
  it('reports drift without writing and repairs only owned outputs idempotently', () => {
    const root = fixture();
    const packageRoot = path.join(root, 'packages/agent-plugins');
    const target = path.join(packageRoot, 'agents/reviewer.md');
    const stale = path.join(packageRoot, 'agents/retired.md');
    const native = path.join(packageRoot, 'agents/codex/maestria-reviewer.toml');
    const nativeBefore = fs.readFileSync(native, 'utf-8');
    fs.writeFileSync(target, 'drift\n');
    fs.writeFileSync(stale, 'stale\n');

    expect(syncConsolidatedPlugin(root, true)).toContain('agents/reviewer.md');
    expect(syncConsolidatedPlugin(root, true)).toContain('agents/retired.md');
    expect(fs.readFileSync(target, 'utf-8')).toBe('drift\n');
    expect(fs.existsSync(stale)).toBe(true);
    syncConsolidatedPlugin(root);

    expect(syncConsolidatedPlugin(root, true)).toEqual([]);
    expect(syncConsolidatedPlugin(root)).toEqual([]);
    expect(fs.existsSync(stale)).toBe(false);
    expect(fs.readFileSync(target, 'utf-8')).toContain('Read-only role (advisory)');
    expect(fs.readFileSync(native, 'utf-8')).toBe(nativeBefore);
  });

  it('fails before writes or cleanup when a required native resource is missing', () => {
    const root = fixture();
    const packageRoot = path.join(root, 'packages/agent-plugins');
    const target = path.join(packageRoot, 'agents/builder.md');
    const stale = path.join(packageRoot, 'agents/retired.md');
    fs.writeFileSync(target, 'drift\n');
    fs.writeFileSync(stale, 'stale\n');
    fs.rmSync(path.join(packageRoot, 'agents/codex/maestria-writer.toml'));

    expect(() => syncConsolidatedPlugin(root)).toThrow(/maestria-writer\.toml/u);
    expect(fs.readFileSync(target, 'utf-8')).toBe('drift\n');
    expect(fs.readFileSync(stale, 'utf-8')).toBe('stale\n');
  });

  it('rejects malformed shared role metadata before changing outputs', () => {
    const root = fixture();
    const packageRoot = path.join(root, 'packages/agent-plugins');
    const target = path.join(packageRoot, 'agents/builder.md');
    fs.writeFileSync(target, 'drift\n');
    fs.writeFileSync(path.join(packageRoot, 'skills/writer/SKILL.md'), 'missing frontmatter\n');

    expect(() => syncConsolidatedPlugin(root)).toThrow(/frontmatter/u);
    expect(fs.readFileSync(target, 'utf-8')).toBe('drift\n');
  });

  it('rejects linked output directories without writing outside the package', () => {
    const root = fixture();
    const packageRoot = path.join(root, 'packages/agent-plugins');
    const external = path.join(root, 'external');
    fs.mkdirSync(external);
    fs.writeFileSync(path.join(external, 'sentinel.md'), 'untouched\n');
    fs.rmSync(path.join(packageRoot, 'agents'), { recursive: true });
    fs.symlinkSync(external, path.join(packageRoot, 'agents'));

    expect(() => syncConsolidatedPlugin(root)).toThrow(/symlink/u);
    expect(fs.readdirSync(external)).toEqual(['sentinel.md']);
    expect(fs.readFileSync(path.join(external, 'sentinel.md'), 'utf-8')).toBe('untouched\n');
  });
});
