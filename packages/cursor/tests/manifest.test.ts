import { describe, it, expect } from 'vite-plus/test';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, '..');

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

interface PluginManifest {
  name?: string;
  version?: string;
  description?: string;
  author?: { name?: string };
  license?: string;
  keywords?: string[];
}

async function readJson<T>(relativePath: string): Promise<T> {
  const absolute = path.join(PACKAGE_ROOT, relativePath);
  const raw = await readFile(absolute, 'utf8');
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

function parseFrontmatter(text: string): { data: Record<string, unknown>; body: string } {
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== '---') {
    throw new Error('missing opening frontmatter fence');
  }
  const close = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (close === -1) {
    throw new Error('missing closing frontmatter fence');
  }
  const yamlText = lines.slice(1, close).join('\n').trim();
  const data: Record<string, unknown> = {};
  for (const line of yamlText.split(/\r?\n/)) {
    const m = /^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/.exec(line);
    if (m === null) continue;
    const [, key, rawValue] = m;
    if (rawValue === undefined) continue;
    const value = rawValue.trim();
    if (value === 'true') data[key] = true;
    else if (value === 'false') data[key] = false;
    else if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      data[key] = value.slice(1, -1);
    } else {
      data[key] = value;
    }
  }
  const body = lines.slice(close + 1).join('\n');
  return { data, body };
}

describe('.cursor-plugin/plugin.json', () => {
  it('exists and parses as valid JSON', async () => {
    const manifest = await readJson<PluginManifest>('.cursor-plugin/plugin.json');
    expect(typeof manifest).toBe('object');
    expect(manifest).not.toBeNull();
  });

  it('has required name, version, and author', async () => {
    const manifest = await readJson<PluginManifest>('.cursor-plugin/plugin.json');
    expect(manifest.name).toBe('maestria');
    expect(typeof manifest.version).toBe('string');
    expect(manifest.version!.length).toBeGreaterThan(0);
    expect(manifest.author?.name).toBeDefined();
    expect(manifest.license).toBe('MIT');
  });
});

describe('agents directory', () => {
  it('contains all 7 specialist agents', async () => {
    for (const agent of EXPECTED_AGENTS) {
      const agentPath = path.join(PACKAGE_ROOT, 'agents', `${agent}.md`);
      expect(await pathExists(agentPath)).toBe(true);
    }
  });

  for (const agent of EXPECTED_AGENTS) {
    describe(`agents/${agent}.md`, () => {
      it('has name and description frontmatter', async () => {
        const text = await readFile(path.join(PACKAGE_ROOT, 'agents', `${agent}.md`), 'utf8');
        const { data } = parseFrontmatter(text);
        expect(data.name).toBe(agent);
        expect(typeof data.description).toBe('string');
        expect((data.description as string).length).toBeGreaterThan(0);
      });
    });
  }

  it('reviewer agent forbids edits near the top', async () => {
    const text = await readFile(path.join(PACKAGE_ROOT, 'agents', 'reviewer.md'), 'utf8');
    const head = text.slice(0, 1500);
    expect(head).toMatch(/do \*\*not\*\* use Write|do not edit|Checker only/i);
  });

  it('adventurer agent is read-only near the top', async () => {
    const text = await readFile(path.join(PACKAGE_ROOT, 'agents', 'adventurer.md'), 'utf8');
    const head = text.slice(0, 1500);
    expect(head).toMatch(/Read-only/i);
  });
});

describe('skills/orchestrator', () => {
  it('exists with name and description', async () => {
    const skillPath = path.join(PACKAGE_ROOT, 'skills', 'orchestrator', 'SKILL.md');
    expect(await pathExists(skillPath)).toBe(true);
    const text = await readFile(skillPath, 'utf8');
    const { data } = parseFrontmatter(text);
    expect(data.name).toBe('orchestrator');
    expect(typeof data.description).toBe('string');
  });

  it('mentions Task and all 7 specialists', async () => {
    const text = await readFile(
      path.join(PACKAGE_ROOT, 'skills', 'orchestrator', 'SKILL.md'),
      'utf8',
    );
    expect(text).toContain('Task');
    for (const specialist of EXPECTED_AGENTS) {
      expect(text).toContain(specialist);
    }
  });
});

describe('rules/maestria-global.mdc', () => {
  it('exists with alwaysApply: true', async () => {
    const rulesPath = path.join(PACKAGE_ROOT, 'rules', 'maestria-global.mdc');
    expect(await pathExists(rulesPath)).toBe(true);
    const text = await readFile(rulesPath, 'utf8');
    const { data } = parseFrontmatter(text);
    expect(data.alwaysApply).toBe(true);
    expect(typeof data.description).toBe('string');
  });

  it('contains delegation table with 7 specialists', async () => {
    const text = await readFile(path.join(PACKAGE_ROOT, 'rules', 'maestria-global.mdc'), 'utf8');
    expect(text).toContain('## Delegation');
    for (const specialist of EXPECTED_AGENTS) {
      expect(text).toContain(specialist);
    }
  });
});

describe('commands', () => {
  for (const command of EXPECTED_COMMANDS) {
    it(`commands/${command}.md exists with name frontmatter`, async () => {
      const commandPath = path.join(PACKAGE_ROOT, 'commands', `${command}.md`);
      expect(await pathExists(commandPath)).toBe(true);
      const text = await readFile(commandPath, 'utf8');
      const { data } = parseFrontmatter(text);
      expect(data.name).toBe(command);
      expect(typeof data.description).toBe('string');
    });
  }
});

describe('package.json', () => {
  it('has the expected name and private flag', async () => {
    const pkg = await readJson<Record<string, unknown>>('package.json');
    expect(pkg.name).toBe('@maestria/cursor');
    expect(pkg.private).toBe(true);
    expect(pkg.type).toBe('module');
  });
});
