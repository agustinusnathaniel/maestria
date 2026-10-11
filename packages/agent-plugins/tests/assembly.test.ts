import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { main, syncConsolidatedPlugin } from '../../../scripts/sync-consolidated-plugin.js';

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
  fs.mkdirSync(path.join(root, 'packages/core'), { recursive: true });
  fs.cpSync(
    path.join(repoRoot, 'packages/core/agent-directives'),
    path.join(root, 'packages/core/agent-directives'),
    { recursive: true },
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
    const target = path.join(packageRoot, 'integrations/omp/README.md');
    const stale = path.join(packageRoot, 'skills/handoff.md');
    const native = path.join(packageRoot, 'generation/codex/maestria-reviewer.toml');
    const nativeBefore = fs.readFileSync(native, 'utf-8');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, 'drift\n');
    fs.writeFileSync(stale, 'stale\n');

    expect(syncConsolidatedPlugin(root, true)).toContain('integrations/omp/README.md');
    expect(syncConsolidatedPlugin(root, true)).toContain('skills/handoff.md');
    expect(fs.readFileSync(target, 'utf-8')).toBe('drift\n');
    expect(fs.existsSync(stale)).toBe(true);
    syncConsolidatedPlugin(root);

    expect(syncConsolidatedPlugin(root, true)).toEqual([]);
    expect(syncConsolidatedPlugin(root)).toEqual([]);
    expect(fs.existsSync(stale)).toBe(false);
    expect(fs.readFileSync(target, 'utf-8')).toContain('OMP Integration');
    expect(fs.readFileSync(native, 'utf-8')).toBe(nativeBefore);
  });

  it('fails before writes or cleanup when a required native resource is missing', () => {
    const root = fixture();
    const packageRoot = path.join(root, 'packages/agent-plugins');
    const target = path.join(packageRoot, 'integrations/omp/README.md');
    const stale = path.join(packageRoot, 'skills/handoff.md');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, 'drift\n');
    fs.writeFileSync(stale, 'stale\n');
    fs.rmSync(path.join(packageRoot, 'generation/codex/maestria-writer.toml'));

    expect(main(['--preflight'], root)).toBe(0);
    expect(() => syncConsolidatedPlugin(root)).toThrow(/maestria-writer\.toml/u);
    expect(fs.readFileSync(target, 'utf-8')).toBe('drift\n');
    expect(fs.readFileSync(stale, 'utf-8')).toBe('stale\n');
  });

  it('preserves unowned files while cleaning obsolete generated resources', () => {
    const root = fixture();
    const packageRoot = path.join(root, 'packages/agent-plugins');
    const notes = [
      'plugin/operator-note.md',
      'generation/operator-note.md',
      'agents/operator-note.md',
      'integrations/claude-code/operator-note.md',
    ];
    for (const note of notes) {
      const target = path.join(packageRoot, note);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, 'preserve this note\n');
    }
    const obsolete = path.join(packageRoot, 'commands/modes/fein.md');
    fs.mkdirSync(path.dirname(obsolete), { recursive: true });
    fs.writeFileSync(obsolete, 'obsolete generated resource\n');

    expect(syncConsolidatedPlugin(root, true)).toContain('commands/modes/fein.md');
    syncConsolidatedPlugin(root);
    expect(fs.existsSync(obsolete)).toBe(false);
    expect(syncConsolidatedPlugin(root, true)).toEqual([]);
    for (const note of notes) {
      expect(fs.readFileSync(path.join(packageRoot, note), 'utf-8')).toBe('preserve this note\n');
    }
  });

  it('rejects malformed shared role metadata before changing outputs', () => {
    const root = fixture();
    const packageRoot = path.join(root, 'packages/agent-plugins');
    const target = path.join(packageRoot, 'integrations/omp/README.md');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, 'drift\n');
    fs.writeFileSync(path.join(packageRoot, 'agents/writer.md'), 'missing frontmatter\n');

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

    expect(main(['--preflight'], root)).toBe(2);
    expect(() => syncConsolidatedPlugin(root)).toThrow(/symlink/u);
    expect(fs.readdirSync(external)).toEqual(['sentinel.md']);
    expect(fs.readFileSync(path.join(external, 'sentinel.md'), 'utf-8')).toBe('untouched\n');
  });
});
