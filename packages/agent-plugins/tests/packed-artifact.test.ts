import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vite-plus/test';

const packageRoot = path.resolve(import.meta.dirname, '..');
const repoRoot = path.resolve(packageRoot, '../..');
const roles = ['adventurer', 'architect', 'builder', 'diagnose', 'planner', 'reviewer', 'writer'];
const readOnlyRoles = ['adventurer', 'planner', 'reviewer'];
const manifestPaths = [
  'plugin.json',
  '.claude-plugin/plugin.json',
  '.cursor-plugin/plugin.json',
  '.codex-plugin/plugin.json',
  '.devin-plugin/plugin.json',
  '.zcode-plugin/plugin.json',
  'kimi.plugin.json',
];

type Manifest = Record<string, unknown>;
const isRecord = (value: unknown): value is Manifest =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readManifest = (root: string, relative: string): Manifest => {
  const value: unknown = JSON.parse(fs.readFileSync(path.join(root, relative), 'utf-8'));
  if (!isRecord(value)) {
    throw new Error(`Expected manifest object: ${relative}`);
  }
  return value;
};

const packedArtifact = (output: string): { filename: string; files: string[] } => {
  const value: unknown = JSON.parse(output);
  if (!isRecord(value) || typeof value.filename !== 'string' || !Array.isArray(value.files)) {
    throw new TypeError('Expected pnpm pack result object');
  }
  return {
    filename: value.filename,
    files: value.files.flatMap((file: unknown) =>
      isRecord(file) && typeof file.path === 'string' ? [file.path] : [],
    ),
  };
};

const packageFixture = (destination: string): string => {
  const fixtureRoot = path.join(destination, 'source-package');
  fs.cpSync(packageRoot, fixtureRoot, {
    filter: (source) => !source.split(path.sep).includes('node_modules'),
    recursive: true,
  });
  return fixtureRoot;
};

const assertResourcePaths = (manifest: Manifest, packedRoot: string): void => {
  for (const field of ['skills', 'agents', 'commands', 'rules']) {
    const declared = manifest[field];
    if (declared === undefined) {
      continue;
    }
    for (const relative of Array.isArray(declared) ? declared : [declared]) {
      expect(typeof relative).toBe('string');
      const absolute = path.resolve(packedRoot, String(relative));
      expect(absolute.startsWith(`${packedRoot}${path.sep}`)).toBe(true);
      expect(fs.existsSync(absolute), `missing ${String(relative)}`).toBe(true);
    }
  }
  for (const field of ['hooks', 'mcpServers', 'automations']) {
    expect(manifest[field]).toBeUndefined();
  }
};

const assertNativeMetadata = (packedRoot: string): void => {
  for (const role of readOnlyRoles) {
    const claude = fs.readFileSync(path.join(packedRoot, `agents/claude-code/${role}.md`), 'utf-8');
    const cursor = fs.readFileSync(path.join(packedRoot, `agents/cursor/${role}.md`), 'utf-8');
    const codex = fs.readFileSync(
      path.join(packedRoot, `agents/codex/maestria-${role}.toml`),
      'utf-8',
    );
    const advisory = fs.readFileSync(path.join(packedRoot, `agents/${role}.md`), 'utf-8');
    expect(claude).toContain('disallowedTools: Write, Edit');
    expect(cursor).toContain('readonly: true');
    expect(codex).toContain('sandbox_mode = "read-only"');
    expect(advisory).toContain('Read-only role (advisory)');
    expect(advisory).not.toMatch(/^(?:readonly|disallowedTools|sandbox_mode):/mu);
  }
};

describe('published consolidated plugin', () => {
  it('packs the flattened install root with complete skills, native paths, and runtime metadata', () => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'maestria-plugin-pack-'));
    try {
      const fixtureRoot = packageFixture(temporary);
      const packed = packedArtifact(
        execFileSync('pnpm', ['pack', '--json', '--pack-destination', temporary], {
          cwd: fixtureRoot,
          encoding: 'utf-8',
        }),
      );
      const archive = packed.filename;
      const entries = execFileSync('tar', ['-tzf', archive], { encoding: 'utf-8' })
        .trim()
        .split('\n');
      execFileSync('tar', ['-xzf', archive, '-C', temporary]);
      const packedRoot = path.join(temporary, 'package');
      const packageManifest = readManifest(packedRoot, 'package.json');
      const manifests = manifestPaths.map((relative) => readManifest(packedRoot, relative));
      for (const manifest of manifests) {
        expect(manifest.name).toBe('maestria');
        expect(manifest.version).toBe(packageManifest.version);
        assertResourcePaths(manifest, packedRoot);
      }
      const skills = entries.filter((entry) => /^package\/skills\/[^/]+\/SKILL\.md$/u.test(entry));
      expect(entries.filter((entry) => entry.endsWith('/SKILL.md'))).toHaveLength(14);
      expect(skills).toHaveLength(14);
      expect(skills.every((entry) => /^package\/skills\/[^/]+\/SKILL\.md$/u.test(entry))).toBe(
        true,
      );
      expect(new Set(skills.map((entry) => entry.split('/')[2])).size).toBe(14);
      const rootAgents = entries.filter((entry) => /^package\/agents\/[^/]+\.md$/u.test(entry));
      expect(rootAgents).toHaveLength(roles.length);
      expect(
        entries.some((entry) =>
          /(?:generation\/|sync\.config|\.test\.ts|vite\.config|tsconfig)/u.test(entry),
        ),
      ).toBe(false);
      expect(entries.some((entry) => /^package\/(?:commands|rules)\//u.test(entry))).toBe(false);
      expect(packageManifest.private).toBe(false);
      expect(packageManifest.publishConfig).toEqual({ access: 'public', provenance: true });
      expect(packageManifest.devDependencies).toBeUndefined();
      expect(packageManifest.scripts).toBeUndefined();
      expect(packageManifest.pnpm).toBeUndefined();
      expect(packageManifest.packageManager).toBeUndefined();
      expect(packageManifest.omp).toEqual({});
      expect(manifests[1].skills).toBeUndefined();
      expect(manifests[1].agents).toEqual(roles.map((role) => `./agents/claude-code/${role}.md`));
      expect(manifests[5].agents).toEqual(roles.map((role) => `./agents/${role}.md`));
      expect(manifests[5].commands).toEqual([]);
      expect(manifests[6].agents).toEqual([]);
      expect(manifests[6].skills).toBe('./skills/');
      expect(manifests[6].commands).toBe('./integrations/kimi-code/commands/');
      expect(manifests[6].systemPromptPath).toBe('./skills/global-rules/SKILL.md');
      expect(manifests[1].commands).toEqual([]);
      expect(manifests[2].commands).toBe('./integrations/cursor/commands/');
      expect(manifests[2].rules).toBe('./integrations/cursor/rules/');
      for (const role of roles) {
        expect(entries).toContain(`package/agents/${role}.md`);
      }
      expect(entries).toContain('package/integrations/cursor/commands/fein.md');
      expect(entries).toContain('package/integrations/cursor/rules/maestria-global.mdc');
      expect(entries).toContain('package/integrations/codex/instructions/AGENTS.md');
      expect(entries).toContain('package/integrations/kimi-code/commands/fein.md');
      assertNativeMetadata(packedRoot);
      for (const host of [
        'claude-code',
        'cursor',
        'codex',
        'devin',
        'zcode',
        'kimi-code',
        'hermes',
        'omp',
      ]) {
        const guide = fs.readFileSync(
          path.join(packedRoot, `integrations/${host}/README.md`),
          'utf-8',
        );
        expect(guide).toContain('Integration');
      }
      const evidence = path.join(repoRoot, 'artifacts/plugin-pack-evidence.json');
      fs.mkdirSync(path.dirname(evidence), { recursive: true });
      fs.writeFileSync(
        evidence,
        `${JSON.stringify(
          {
            archiveSha256: createHash('sha256').update(fs.readFileSync(archive)).digest('hex'),
            entries,
            liveHostLoading: 'unverified',
            manifests: manifestPaths,
            nativeReadOnlyRoles: readOnlyRoles,
            reproduction: 'pnpm --filter @maestria/agent-plugins test',
            result: 'passed',
            sharedSkills: skills,
          },
          null,
          2,
        )}\n`,
      );
    } finally {
      fs.rmSync(temporary, { force: true, recursive: true });
    }
  });
});
