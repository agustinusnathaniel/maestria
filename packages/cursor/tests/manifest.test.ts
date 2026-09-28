import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vite-plus/test';

const __dirname = import.meta.dirname;
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

// Cursor blocks write tools at runtime through the `readonly` agent frontmatter
// flag (ADR-CR-001), so these are the specialists the maker/checker split fences
// off from editing.
const READONLY_AGENTS: readonly string[] = ['adventurer', 'planner', 'reviewer'];

type JsonObject = Record<string, unknown>;

const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readJson = async (relativePath: string): Promise<JsonObject> => {
  const absolute = path.join(PACKAGE_ROOT, relativePath);
  const raw = await readFile(absolute, 'utf-8');
  const value: unknown = JSON.parse(raw);
  if (!isJsonObject(value)) {
    throw new Error(`expected a JSON object: ${relativePath}`);
  }
  return value;
};

const pathExists = async (absolutePath: string): Promise<boolean> => {
  try {
    await stat(absolutePath);
    return true;
  } catch {
    return false;
  }
};

const parseFrontmatter = (text: string): { data: Record<string, unknown>; body: string } => {
  const lines = text.split(/\r?\n/u);
  if (lines[0]?.trim() !== '---') {
    throw new Error('missing opening frontmatter fence');
  }
  const close = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (close === -1) {
    throw new Error('missing closing frontmatter fence');
  }
  const yamlText = lines.slice(1, close).join('\n').trim();
  const data: Record<string, unknown> = {};
  for (const line of yamlText.split(/\r?\n/u)) {
    const m = /^(?<key>[A-Za-z][A-Za-z0-9_-]*):\s*(?<rawValue>.*)$/u.exec(line);
    if (m === null) {
      continue;
    }
    const key = m.groups?.key;
    const rawValue = m.groups?.rawValue;
    if (key === undefined || rawValue === undefined) {
      continue;
    }
    const value = rawValue.trim();
    if (value === 'true') {
      data[key] = true;
    } else if (value === 'false') {
      data[key] = false;
    } else if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      data[key] = value.slice(1, -1);
    } else {
      data[key] = value;
    }
  }
  const body = lines.slice(close + 1).join('\n');
  return { body, data };
};

describe('.cursor-plugin/plugin.json', () => {
  it('has required name, version, and author', async () => {
    const [manifest, pkg] = await Promise.all([
      readJson('.cursor-plugin/plugin.json'),
      readJson('package.json'),
    ]);
    expect(manifest.name).toBe('maestria');
    expect(typeof manifest.version).toBe('string');
    if (typeof manifest.version === 'string') {
      expect(manifest.version.length).toBeGreaterThan(0);
    }
    expect(manifest.version).toBe(pkg.version);
    const author = isJsonObject(manifest.author) ? manifest.author : undefined;
    expect(author?.name).toBeDefined();
    expect(manifest.license).toBe('MIT');
  });
});

describe('agents directory', () => {
  it('contains all 7 specialist agents', async () => {
    await Promise.all(
      EXPECTED_AGENTS.map(async (agent) => {
        const agentPath = path.join(PACKAGE_ROOT, 'agents', `${agent}.md`);
        expect(await pathExists(agentPath)).toBe(true);
      }),
    );
  });

  for (const agent of EXPECTED_AGENTS) {
    describe(`agents/${agent}.md`, () => {
      it('has name and description frontmatter', async () => {
        const text = await readFile(path.join(PACKAGE_ROOT, 'agents', `${agent}.md`), 'utf-8');
        const { data } = parseFrontmatter(text);
        expect(data.name).toBe(agent);
        expect(typeof data.description).toBe('string');
        if (typeof data.description === 'string') {
          expect(data.description.length).toBeGreaterThan(0);
        }
      });
    });
  }
});

describe('read-only maker/checker boundary', () => {
  for (const agent of READONLY_AGENTS) {
    it(`blocks write tools when the readonly flag is set on ${agent}`, async () => {
      const text = await readFile(path.join(PACKAGE_ROOT, 'agents', `${agent}.md`), 'utf-8');
      const { data } = parseFrontmatter(text);
      expect(data.readonly).toBe(true);
    });
  }

  it('leaves write tools enabled when a write specialist omits the readonly flag', async () => {
    const writeSpecialists = EXPECTED_AGENTS.filter((agent) => !READONLY_AGENTS.includes(agent));
    await Promise.all(
      writeSpecialists.map(async (agent) => {
        const text = await readFile(path.join(PACKAGE_ROOT, 'agents', `${agent}.md`), 'utf-8');
        const { data } = parseFrontmatter(text);
        expect(data.readonly).toBeUndefined();
      }),
    );
  });
});

describe('skills/orchestrator', () => {
  it('exists with name and description', async () => {
    const skillPath = path.join(PACKAGE_ROOT, 'skills', 'orchestrator', 'SKILL.md');
    expect(await pathExists(skillPath)).toBe(true);
    const text = await readFile(skillPath, 'utf-8');
    const { data } = parseFrontmatter(text);
    expect(data.name).toBe('orchestrator');
    expect(typeof data.description).toBe('string');
  });

  it('mentions Task and all 7 specialists', async () => {
    const text = await readFile(
      path.join(PACKAGE_ROOT, 'skills', 'orchestrator', 'SKILL.md'),
      'utf-8',
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
    const text = await readFile(rulesPath, 'utf-8');
    const { data } = parseFrontmatter(text);
    expect(data.alwaysApply).toBe(true);
    expect(typeof data.description).toBe('string');
  });

  it('contains delegation table with 7 specialists', async () => {
    const text = await readFile(path.join(PACKAGE_ROOT, 'rules', 'maestria-global.mdc'), 'utf-8');
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
      const text = await readFile(commandPath, 'utf-8');
      const { data } = parseFrontmatter(text);
      expect(data.name).toBe(command);
      expect(typeof data.description).toBe('string');
    });
  }
});

describe('package.json', () => {
  it('has the expected name and private flag', async () => {
    const pkg = await readJson('package.json');
    expect(pkg.name).toBe('@maestria/cursor');
    expect(pkg.private).toBe(false);
    expect(pkg.type).toBe('module');
  });

  it('ships manifest-referenced assets', async () => {
    const pkg = await readJson('package.json');
    expect(pkg.files).toContain('assets');
    expect(await pathExists(path.join(PACKAGE_ROOT, 'assets', 'logo.svg'))).toBe(true);
  });
});
