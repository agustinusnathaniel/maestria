import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import {
  GENERATED_NOTICE,
  main,
  syncConsolidatedPlugin,
  TOML_NOTICE,
} from '../../../scripts/sync-consolidated-plugin.js';

const repoRoot = path.resolve(import.meta.dirname, '../../..');
// A file the generator wrote carries its notice; that marker, not a path list, makes it owned.
const generated = (body: string): string => `---\n---\n\n${GENERATED_NOTICE}\n\n${body}\n`;
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
    const target = path.join(packageRoot, 'rules/global.md');
    const stale = path.join(packageRoot, 'skills/handoff.md');
    const native = path.join(packageRoot, 'generation/profiles.json');
    const nativeBefore = fs.readFileSync(native, 'utf-8');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, 'drift\n');
    fs.writeFileSync(stale, generated('stale'));

    expect(syncConsolidatedPlugin(root, true)).toContain('rules/global.md');
    expect(syncConsolidatedPlugin(root, true)).toContain('skills/handoff.md');
    expect(fs.readFileSync(target, 'utf-8')).toBe('drift\n');
    expect(fs.existsSync(stale)).toBe(true);
    syncConsolidatedPlugin(root);

    expect(syncConsolidatedPlugin(root, true)).toEqual([]);
    expect(syncConsolidatedPlugin(root)).toEqual([]);
    expect(fs.existsSync(stale)).toBe(false);
    expect(fs.readFileSync(target, 'utf-8')).toContain('maestria global policy');
    expect(fs.readFileSync(native, 'utf-8')).toBe(nativeBefore);
  });

  it('fails before writes or cleanup when a required native resource is missing', () => {
    const root = fixture();
    const packageRoot = path.join(root, 'packages/agent-plugins');
    const target = path.join(packageRoot, 'rules/global.md');
    const stale = path.join(packageRoot, 'skills/handoff.md');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, 'drift\n');
    fs.writeFileSync(stale, generated('stale'));
    fs.rmSync(path.join(packageRoot, 'generation/profiles.json'));

    expect(main(['--preflight'], root)).toBe(2);
    expect(() => syncConsolidatedPlugin(root)).toThrow(/profiles\.json/u);
    expect(fs.readFileSync(target, 'utf-8')).toBe('drift\n');
    expect(fs.readFileSync(stale, 'utf-8')).toBe(generated('stale'));
  });

  it('preserves unowned files while cleaning obsolete generated resources', () => {
    const root = fixture();
    const packageRoot = path.join(root, 'packages/agent-plugins');
    const notes = [
      'plugin/operator-note.md',
      'generation/operator-note.md',
      'agents/operator-note.md',
      'integrations/claude-code/operator-note.md',
      'rules/operator-note.md',
    ];
    for (const note of notes) {
      const target = path.join(packageRoot, note);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, 'preserve this note\n');
    }
    const obsoletes = [
      'commands/modes/fein.md',
      'agents/cursor/reviewer.md',
      'commands/kimi-code/fein.md',
      'compatibility/devin/skills/fein/SKILL.md',
      'rules/retired-host/context.md',
    ];
    for (const obsolete of obsoletes) {
      fs.mkdirSync(path.dirname(path.join(packageRoot, obsolete)), { recursive: true });
      fs.writeFileSync(path.join(packageRoot, obsolete), generated('obsolete generated resource'));
    }
    const obsoleteProfile = 'agents/codex/maestria-reviewer.toml';
    fs.mkdirSync(path.dirname(path.join(packageRoot, obsoleteProfile)), { recursive: true });
    fs.writeFileSync(
      path.join(packageRoot, obsoleteProfile),
      `name = "maestria-reviewer"\r\n\r\n${TOML_NOTICE}\r\n`,
    );
    obsoletes.push(obsoleteProfile);

    expect(syncConsolidatedPlugin(root, true)).toEqual(expect.arrayContaining(obsoletes));
    syncConsolidatedPlugin(root);
    for (const obsolete of obsoletes) {
      expect(fs.existsSync(path.join(packageRoot, obsolete))).toBe(false);
    }
    expect(fs.existsSync(path.join(packageRoot, 'compatibility'))).toBe(false);
    expect(syncConsolidatedPlugin(root, true)).toEqual([]);
    for (const note of notes) {
      expect(fs.readFileSync(path.join(packageRoot, note), 'utf-8')).toBe('preserve this note\n');
    }
  });

  it('rejects mode-only commands on a host without always-on policy before writes', () => {
    const root = fixture();
    const packageRoot = path.join(root, 'packages/agent-plugins');
    const target = path.join(packageRoot, 'rules/global.md');
    fs.writeFileSync(target, 'drift\n');
    const manifestPath = path.join(packageRoot, '.zcode-plugin/plugin.json');
    const manifest = fs.readFileSync(manifestPath, 'utf-8');
    expect(manifest).toContain('"commands": "./commands/"');
    for (const selector of ['"./mode-commands/"', '["./mode-commands/fein.md"], "rules": []']) {
      fs.writeFileSync(
        manifestPath,
        manifest.replace('"commands": "./commands/"', `"commands": ${selector}`),
      );

      expect(main(['--preflight'], root)).toBe(2);
      expect(() => syncConsolidatedPlugin(root)).toThrow(/always-on policy/u);
      expect(fs.readFileSync(target, 'utf-8')).toBe('drift\n');
    }
  });

  it('rejects a missing canonical role before changing outputs', () => {
    const root = fixture();
    const packageRoot = path.join(root, 'packages/agent-plugins');
    const target = path.join(packageRoot, 'rules/global.md');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, 'drift\n');
    fs.rmSync(path.join(root, 'packages/core/agent-directives/specialists/reviewer.md'));

    expect(() => syncConsolidatedPlugin(root)).toThrow(/reviewer\.md/u);
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
