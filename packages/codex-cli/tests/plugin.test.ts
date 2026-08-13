import { describe, it, expect } from 'vite-plus/test';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, '..');

const EXPECTED_SKILLS = [
  'adventurer',
  'architect',
  'blitz',
  'builder',
  'diagnose',
  'fein',
  'global-rules',
  'handoff',
  'iteration-limits',
  'orchestrator',
  'planner',
  'reviewer',
  'sonar',
  'writer',
] as const;

interface PluginManifest {
  name?: string;
  version?: string;
  description?: string;
  skills?: string;
  hooks?: unknown;
  mcpServers?: unknown;
  apps?: unknown;
}

async function readJson<T>(relativePath: string): Promise<T> {
  const text = await readFile(path.join(PACKAGE_ROOT, relativePath), 'utf8');
  return JSON.parse(text) as T;
}

async function pathExists(relativePath: string): Promise<boolean> {
  try {
    await stat(path.join(PACKAGE_ROOT, relativePath));
    return true;
  } catch {
    return false;
  }
}

function parseFrontmatter(text: string): Record<string, string> {
  const lines = text.split(/\r?\n/);
  expect(lines[0]?.trim()).toBe('---');
  const close = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  expect(close).toBeGreaterThan(0);

  const data: Record<string, string> = {};
  for (const line of lines.slice(1, close)) {
    const match = /^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/.exec(line);
    if (match !== null && match[2] !== undefined) data[match[1]] = match[2];
  }
  return data;
}

describe('.codex-plugin/plugin.json manifest', () => {
  it('has the Codex plugin identity and skills entry point', async () => {
    const [manifest, pkg] = await Promise.all([
      readJson<PluginManifest>('.codex-plugin/plugin.json'),
      readJson<Record<string, unknown>>('package.json'),
    ]);
    expect(manifest.name).toBe('maestria');
    expect(manifest.version).toBe(pkg.version as string);
    expect(manifest.description).toBeTruthy();
    expect(manifest.skills).toBe('./skills/');
  });

  it('does not ship unimplemented integrations or hooks', async () => {
    const manifest = await readJson<PluginManifest>('.codex-plugin/plugin.json');
    expect(manifest.hooks).toBeUndefined();
    expect(manifest.mcpServers).toBeUndefined();
    expect(manifest.apps).toBeUndefined();
  });
});

describe('generated skills', () => {
  it('contains exactly the projected skill directories', async () => {
    const entries = await readdir(path.join(PACKAGE_ROOT, 'skills'), { withFileTypes: true });
    const names = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    expect(names).toEqual([...EXPECTED_SKILLS].sort());
  });

  for (const skill of EXPECTED_SKILLS) {
    it(`${skill} has a valid name and description`, async () => {
      const relativePath = `skills/${skill}/SKILL.md`;
      expect(await pathExists(relativePath)).toBe(true);
      const frontmatter = parseFrontmatter(
        await readFile(path.join(PACKAGE_ROOT, relativePath), 'utf8'),
      );
      expect(frontmatter.name).toBe(skill);
      expect(frontmatter.description).toBeTruthy();
    });
  }

  it('uses Codex namespaced specialist references', async () => {
    const text = await readFile(path.join(PACKAGE_ROOT, 'skills/orchestrator/SKILL.md'), 'utf8');
    expect(text).toContain('$maestria:builder');
    expect(text).toContain('$maestria:reviewer');
    expect(text).toContain('skills rather than Codex slash commands');
  });

  it('states that read-only role boundaries are advisory', async () => {
    for (const role of ['adventurer', 'planner', 'reviewer']) {
      const text = await readFile(path.join(PACKAGE_ROOT, `skills/${role}/SKILL.md`), 'utf8');
      expect(text).toMatch(/advisory/i);
      expect(text).toMatch(/cannot enforce/i);
    }
  });
});

describe('package metadata', () => {
  it('matches the public workspace package identity', async () => {
    const pkg = await readJson<Record<string, unknown>>('package.json');
    expect(pkg.name).toBe('@maestria/codex-cli');
    expect(pkg.private).toBe(false);
    expect(pkg.type).toBe('module');
  });
});
