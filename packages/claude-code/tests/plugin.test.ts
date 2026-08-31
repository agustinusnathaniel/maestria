import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vite-plus/test';

const __dirname = import.meta.dirname;
const PACKAGE_ROOT = path.resolve(__dirname, '..');

const PLUGIN_NAME_REGEX = /^[a-z0-9][a-z0-9_-]{0,63}$/u;

const EXPECTED_AGENTS = [
  'adventurer',
  'architect',
  'builder',
  'diagnose',
  'planner',
  'reviewer',
  'writer',
] as const;

const EXPECTED_COMMANDS = ['fein', 'sonar', 'blitz'] as const;

// Roles whose Write/Edit tools are denied at the runtime level (user-authorized).
const READ_ONLY_ROLES = ['adventurer', 'planner', 'reviewer'] as const;

interface PluginManifest {
  name?: string;
  displayName?: string;
  version?: string;
  description?: string;
  author?: { name?: string };
  homepage?: string;
  repository?: string;
  license?: string;
  keywords?: string[];
}

interface PackageJson {
  name?: string;
  version?: string;
  files?: string[];
}

async function readJson<T>(relativePath: string): Promise<T> {
  const absolute = path.join(PACKAGE_ROOT, relativePath);
  const raw = await readFile(absolute, 'utf-8');
  return JSON.parse(raw) as T;
}

async function pathExists(absolutePath: string): Promise<boolean> {
  try {
    await stat(absolutePath);
    return true;
  } catch {
    return false;
  }
}

/** Lists a package directory's entries (excluding dotfiles) in sorted order. */
async function readDirNames(relativePath: string): Promise<string[]> {
  const entries = await readdir(path.join(PACKAGE_ROOT, relativePath), {
    withFileTypes: true,
  });
  return entries
    .filter((entry) => !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .toSorted();
}

/**
 * Minimal YAML frontmatter parser for the subset used by generated files:
 * scalar values, inline arrays (`key: [a, b]`), and indented block lists
 * (`key:\n  - a\n  - b`). Matches the repository test convention; the
 * generated frontmatter contains no nested objects.
 */
function parseFrontmatter(text: string): { data: Record<string, string | string[]>; body: string } {
  const lines = text.split(/\r?\n/u);
  if (lines[0]?.trim() !== '---') {
    throw new Error('missing opening frontmatter fence');
  }
  const close = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (close === -1) {
    throw new Error('missing closing frontmatter fence');
  }

  const data: Record<string, string | string[]> = {};
  let currentKey: string | null = null;
  let listValues: string[] = [];

  const flushList = (): void => {
    if (currentKey !== null && listValues.length > 0 && data[currentKey] === undefined) {
      data[currentKey] = [...listValues];
    }
    listValues = [];
  };

  for (const line of lines.slice(1, close)) {
    const blockItem = /^\s+-\s*(.*)$/u.exec(line);
    if (blockItem !== null && currentKey !== null) {
      listValues.push(blockItem[1].trim());
      continue;
    }
    const pair = /^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/u.exec(line);
    if (pair === null) {
      continue;
    }
    flushList();
    const [, key, rawValue] = pair;
    currentKey = key;
    const value = rawValue.trim();
    if (value === '') {
      continue; // key opens a block list below
    }
    if (value.startsWith('[') && value.endsWith(']')) {
      const inner = value.slice(1, -1).trim();
      data[key] =
        inner === '' ? [] : inner.split(',').map((e) => e.trim().replaceAll(/^["']|["']$/gu, ''));
    } else if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      data[key] = value.slice(1, -1);
    } else {
      data[key] = value;
    }
  }

  flushList();

  const body = lines.slice(close + 1).join('\n');
  return { body, data };
}

async function readAgent(
  agent: string,
): Promise<{ data: Record<string, string | string[]>; body: string }> {
  const text = await readFile(path.join(PACKAGE_ROOT, 'agents', `${agent}.md`), 'utf-8');
  return parseFrontmatter(text);
}

describe('.claude-plugin/plugin.json manifest', () => {
  it('exists and parses as valid JSON', async () => {
    const manifest = await readJson<PluginManifest>('.claude-plugin/plugin.json');
    expect(typeof manifest).toBe('object');
    expect(manifest).not.toBeNull();
  });

  it('has a "name" matching the Claude Code plugin name regex', async () => {
    const manifest = await readJson<PluginManifest>('.claude-plugin/plugin.json');
    expect(typeof manifest.name).toBe('string');
    expect(manifest.name).toMatch(PLUGIN_NAME_REGEX);
  });

  it('uses the project-consistent plugin identifier "maestria"', async () => {
    const manifest = await readJson<PluginManifest>('.claude-plugin/plugin.json');
    expect(manifest.name).toBe('maestria');
  });

  it('version aligns with package metadata', async () => {
    const [manifest, pkg] = await Promise.all([
      readJson<PluginManifest>('.claude-plugin/plugin.json'),
      readJson<PackageJson>('package.json'),
    ]);
    expect(manifest.version).toBe(pkg.version);
  });

  it('includes author, repository, license, and description metadata', async () => {
    const manifest = await readJson<PluginManifest>('.claude-plugin/plugin.json');
    expect(manifest.author?.name).toBeDefined();
    expect(manifest.repository).toBeDefined();
    expect(manifest.license).toBeDefined();
    expect(manifest.description).toBeDefined();
  });

  it('does not include policy-excluded or runtime fields', async () => {
    const raw = JSON.parse(
      await readFile(path.join(PACKAGE_ROOT, '.claude-plugin', 'plugin.json'), 'utf-8'),
    ) as Record<string, unknown>;
    const policyExcluded = [
      'hooks',
      'mcpServers',
      'permissionMode',
      'experimental',
      'metadata',
      'userConfig',
    ];
    for (const field of policyExcluded) {
      expect(raw[field]).toBeUndefined();
    }
  });
});

describe('generated agents', () => {
  it('contains exactly the 7 expected specialist agents and nothing else', async () => {
    const names = await readDirNames('agents');
    expect(names).toEqual([...EXPECTED_AGENTS].map((agent) => `${agent}.md`).toSorted());
  });

  for (const agent of EXPECTED_AGENTS) {
    describe(`${agent}.md`, () => {
      it('has valid frontmatter with name, description, and global-rules preload', async () => {
        const { data } = await readAgent(agent);
        expect(data.name).toBe(agent);
        expect(typeof data.description).toBe('string');
        expect((data.description as string).trim().length).toBeGreaterThan(0);
        expect(data.skills).toEqual(['maestria:global-rules']);
      });

      it('has a model metadata field', async () => {
        const { data } = await readAgent(agent);
        expect(data.model).toBe('inherit');
      });

      it('has the auto-generated comment and no source comment', async () => {
        const text = await readFile(path.join(PACKAGE_ROOT, 'agents', `${agent}.md`), 'utf-8');
        expect(text).toContain('Auto-generated from @maestria/core');
        expect(text).not.toMatch(/^<!--\s*Source:/mu);
      });

      it('does not use ignored plugin-agent fields', async () => {
        const { data } = await readAgent(agent);
        expect(data.permissionMode).toBeUndefined();
        expect(data.hooks).toBeUndefined();
        expect(data.mcpServers).toBeUndefined();
      });
    });
  }

  describe('tool restrictions', () => {
    for (const role of READ_ONLY_ROLES) {
      it(`denies exactly the authorized tools {Write, Edit} on ${role}`, async () => {
        const { data } = await readAgent(role);
        const disallowed = (data.disallowedTools ?? '').toString();
        const tools = disallowed
          .split(',')
          .map((tool) => tool.trim())
          .filter((tool) => tool.length > 0);
        expect(tools).toEqual(['Write', 'Edit']);
      });
    }

    it('does not restrict tools on the four other roles', async () => {
      for (const agent of ['architect', 'builder', 'diagnose', 'writer']) {
        const { data } = await readAgent(agent);
        expect(data.disallowedTools).toBeUndefined();
      }
    });
  });
});

describe('generated skills', () => {
  it('contains exactly the 2 expected skills: global-rules and orchestrator', async () => {
    const names = await readDirNames('skills');
    expect(names).toEqual(['global-rules', 'orchestrator']);
  });

  it('generates the global-rules skill from canonical rules', async () => {
    const text = await readFile(
      path.join(PACKAGE_ROOT, 'skills', 'global-rules', 'SKILL.md'),
      'utf-8',
    );
    const { data, body } = parseFrontmatter(text);
    expect(data.name).toBe('global-rules');
    expect(typeof data.description).toBe('string');
    expect(body).toContain('Auto-generated from @maestria/core');
    expect(body).toContain('Global Agent Rules');
  });

  it('generates the orchestrator skill with scoped agent references', async () => {
    const text = await readFile(
      path.join(PACKAGE_ROOT, 'skills', 'orchestrator', 'SKILL.md'),
      'utf-8',
    );
    const { data, body } = parseFrontmatter(text);
    expect(data.name).toBe('orchestrator');
    expect(body).toContain('maestria:adventurer');
    expect(body).toContain('maestria:builder');
    expect(body).toContain('maestria:reviewer');
    expect(body).toContain('maestria:global-rules');
    // The orchestrator references the rules skill rather than embedding it.
    expect(body).not.toContain('# Global Agent Rules');
  });

  it('describes direct capability and advisory orchestration honestly', async () => {
    const text = await readFile(
      path.join(PACKAGE_ROOT, 'skills', 'orchestrator', 'SKILL.md'),
      'utf-8',
    );

    expect(text).toContain('Runtime Authority');
    expect(text).toContain('direct work is available');
    expect(text).toContain('Methodology and skills are advisory guidance');
    expect(text).not.toMatch(/pure dispatcher|Never implement routed code changes yourself/iu);
  });
});

describe('generated commands', () => {
  it('contains exactly the 3 workflow commands and nothing else', async () => {
    const names = await readDirNames('commands');
    expect(names).toEqual([...EXPECTED_COMMANDS].map((command) => `${command}.md`).toSorted());
  });

  for (const command of EXPECTED_COMMANDS) {
    it(`has valid frontmatter for ${command}`, async () => {
      const text = await readFile(path.join(PACKAGE_ROOT, 'commands', `${command}.md`), 'utf-8');
      const { data } = parseFrontmatter(text);
      expect(data.name).toBe(command);
      expect(typeof data.description).toBe('string');
      expect((data.description as string).trim().length).toBeGreaterThan(0);
    });
  }
});

describe('package boundary', () => {
  it('has the exact package identity "@maestria/claude-code"', async () => {
    const pkg = await readJson<PackageJson>('package.json');
    expect(pkg.name).toBe('@maestria/claude-code');
  });

  it('does not ship a rules/ directory or hooks/ directory', async () => {
    expect(await pathExists(path.join(PACKAGE_ROOT, 'rules'))).toBe(false);
    expect(await pathExists(path.join(PACKAGE_ROOT, 'hooks'))).toBe(false);
  });

  it('does not write project or user CLAUDE.md files', async () => {
    expect(await pathExists(path.join(PACKAGE_ROOT, 'CLAUDE.md'))).toBe(false);
  });

  it('packages the plugin components in the npm "files" allowlist', async () => {
    const pkg = await readJson<PackageJson>('package.json');
    for (const entry of [
      '.claude-plugin',
      'agents',
      'skills',
      'commands',
      'README.md',
      'INSTALL.md',
    ]) {
      expect(pkg.files).toContain(entry);
    }
    // No hook resource is allowlisted for packaging.
    expect(pkg.files).not.toContain('hooks');
  });
});
