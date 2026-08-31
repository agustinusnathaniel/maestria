import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { describe, it, expect } from 'vite-plus/test';

const __dirname = import.meta.dirname;
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

const EXPECTED_NATIVE_AGENTS = [
  'maestria-adventurer',
  'maestria-architect',
  'maestria-builder',
  'maestria-diagnose',
  'maestria-planner',
  'maestria-reviewer',
  'maestria-writer',
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

interface PackageManifest {
  version?: string;
}

interface MarketplaceManifest {
  name?: string;
  plugins?: {
    name?: string;
    source?: { source?: string; package?: string };
  }[];
}

async function readJson<T>(relativePath: string): Promise<T> {
  const text = await readFile(path.join(PACKAGE_ROOT, relativePath), 'utf-8');
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
  const lines = text.split(/\r?\n/u);
  expect(lines[0]?.trim()).toBe('---');
  const close = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  expect(close).toBeGreaterThan(0);

  const data: Record<string, string> = {};
  for (const line of lines.slice(1, close)) {
    const match = /^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/u.exec(line);
    if (match !== null && match[2] !== undefined) {
      data[match[1]] = match[2];
    }
  }
  return data;
}

describe('.codex-plugin/plugin.json manifest', () => {
  it('has the Codex plugin identity and skills entry point', async () => {
    const [manifest, pkg] = await Promise.all([
      readJson<PluginManifest>('.codex-plugin/plugin.json'),
      readJson<PackageManifest>('package.json'),
    ]);
    expect(manifest.name).toBe('maestria');
    expect(manifest.version).toBe(pkg.version);
    expect(manifest.description).toBeTruthy();
    expect(manifest.skills).toBe('./skills/');
  });

  it('version aligns with package metadata', async () => {
    const [manifest, pkg] = await Promise.all([
      readJson<PluginManifest>('.codex-plugin/plugin.json'),
      readJson<{ version?: string }>('package.json'),
    ]);
    expect(manifest.version).toBe(pkg.version);
  });

  it('does not ship unimplemented integrations or hooks', async () => {
    const manifest = await readJson<PluginManifest>('.codex-plugin/plugin.json');
    expect(manifest.hooks).toBeUndefined();
    expect(manifest.mcpServers).toBeUndefined();
    expect(manifest.apps).toBeUndefined();
  });
});

describe('repository marketplace entry', () => {
  it('points the native Codex marketplace at the published npm package', async () => {
    const marketplace = JSON.parse(
      await readFile(path.join(PACKAGE_ROOT, '../../.agents/plugins/marketplace.json'), 'utf-8'),
    ) as MarketplaceManifest;
    const plugin = marketplace.plugins?.find((entry) => entry.name === 'maestria');
    expect(marketplace.name).toBe('maestria');
    expect(plugin?.source).toEqual({ package: '@maestria/codex', source: 'npm' });
  });
});

describe('generated skills', () => {
  it('contains exactly the projected skill directories', async () => {
    const entries = await readdir(path.join(PACKAGE_ROOT, 'skills'), { withFileTypes: true });
    const names = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .toSorted();
    expect(names).toEqual([...EXPECTED_SKILLS].toSorted());
  });

  for (const skill of EXPECTED_SKILLS) {
    it(`${skill} has a valid name and description`, async () => {
      const relativePath = `skills/${skill}/SKILL.md`;
      expect(await pathExists(relativePath)).toBe(true);
      const frontmatter = parseFrontmatter(
        await readFile(path.join(PACKAGE_ROOT, relativePath), 'utf-8'),
      );
      expect(frontmatter.name).toBe(skill);
      expect(frontmatter.description).toBeTruthy();
    });
  }

  it('uses Codex namespaced specialist references', async () => {
    const text = await readFile(path.join(PACKAGE_ROOT, 'skills/orchestrator/SKILL.md'), 'utf-8');
    expect(text).toContain('$maestria:builder');
    expect(text).toContain('$maestria:reviewer');
    expect(text).toContain('maestria-builder');
    expect(text).toContain('agent_type');
  });

  it('ships the automatic global orchestration instruction template', async () => {
    const text = await readFile(path.join(PACKAGE_ROOT, 'instructions/AGENTS.md'), 'utf-8');
    expect(text).toContain('maestria:codex-orchestrator:start');
    expect(text).toContain('$maestria:orchestrator');
    expect(text).toContain('agent_type');
    expect(text).toContain('maestria-builder');
    expect(text).toContain('User instructions and repository-local instructions take precedence');
  });

  it('states that read-only role boundaries are advisory', async () => {
    for (const role of ['adventurer', 'planner', 'reviewer']) {
      const text = await readFile(path.join(PACKAGE_ROOT, `skills/${role}/SKILL.md`), 'utf-8');
      expect(text).toMatch(/advisory/iu);
      expect(text).toMatch(/cannot enforce/iu);
    }
  });
});

describe('native Codex agent templates', () => {
  for (const agent of EXPECTED_NATIVE_AGENTS) {
    it(`${agent} has the required native TOML fields`, async () => {
      const relativePath = `agents/${agent}.toml`;
      const text = await readFile(path.join(PACKAGE_ROOT, relativePath), 'utf-8');
      expect(text).toMatch(new RegExp(`^name\\s*=\\s*"${agent}"`, 'mu'));
      expect(text).toMatch(/^description\s*=\s*".+"/mu);
      expect(text).toContain('developer_instructions = """');
      expect(text).toContain(`$maestria:${agent.replace('maestria-', '')}`);
    });
  }

  for (const agent of [
    'maestria-adventurer',
    'maestria-architect',
    'maestria-planner',
    'maestria-reviewer',
  ]) {
    it(`${agent} declares Codex read-only sandboxing`, async () => {
      const text = await readFile(path.join(PACKAGE_ROOT, `agents/${agent}.toml`), 'utf-8');
      expect(text).toContain('sandbox_mode = "read-only"');
    });
  }
});

describe('package metadata', () => {
  it('matches the public workspace package identity', async () => {
    const pkg = await readJson<Record<string, unknown>>('package.json');
    expect(pkg.name).toBe('@maestria/codex');
    expect(pkg.private).toBe(false);
    expect(pkg.type).toBe('module');
    expect(pkg.files).toContain('agents');
    expect(pkg.files).toContain('instructions');
  });
});
