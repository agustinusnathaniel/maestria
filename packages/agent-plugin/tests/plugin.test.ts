import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vite-plus/test';

const PACKAGE_ROOT = path.resolve(import.meta.dirname, '..');

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

type JsonObject = Record<string, unknown>;

const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readJson = async (relativePath: string): Promise<JsonObject> => {
  const value: unknown = JSON.parse(await readFile(path.join(PACKAGE_ROOT, relativePath), 'utf-8'));
  if (!isJsonObject(value)) {
    throw new Error(`expected a JSON object: ${relativePath}`);
  }
  return value;
};

const pathExists = async (relativePath: string): Promise<boolean> => {
  try {
    await stat(path.join(PACKAGE_ROOT, relativePath));
    return true;
  } catch {
    return false;
  }
};

const parseFrontmatter = (text: string): Record<string, string> => {
  const lines = text.split(/\r?\n/u);
  expect(lines[0]?.trim()).toBe('---');
  const close = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  expect(close).toBeGreaterThan(0);

  const data: Record<string, string> = {};
  for (const line of lines.slice(1, close)) {
    const match = /^(?<key>[A-Za-z][A-Za-z0-9_-]*):\s*(?<value>.*)$/u.exec(line);
    const key = match?.groups?.key;
    const value = match?.groups?.value;
    if (key !== undefined && value !== undefined) {
      data[key] = value;
    }
  }
  return data;
};

describe('Agent Plugins v1 manifest', () => {
  it('uses the closed portable manifest surface', async () => {
    const [manifest, pkg] = await Promise.all([readJson('plugin.json'), readJson('package.json')]);

    expect(Object.keys(manifest).toSorted()).toEqual(
      [
        '$schema',
        'author',
        'description',
        'homepage',
        'keywords',
        'license',
        'name',
        'repository',
        'version',
      ].toSorted(),
    );
    expect(manifest.$schema).toBe('https://agent-plugins.org/schemas/1.0.0/plugin.schema.json');
    expect(manifest.name).toBe('maestria');
    expect(manifest.version).toBe(pkg.version);
    expect(manifest.description).toBeTruthy();
    expect(manifest.extensions).toBeUndefined();
  });

  it('does not add non-portable component declarations', async () => {
    const manifest = await readJson('plugin.json');

    expect(manifest.skills).toBeUndefined();
    expect(manifest.mcpServers).toBeUndefined();
    expect(await pathExists('mcp.json')).toBe(false);
  });
});

describe('generated portable skills', () => {
  it('contains exactly the standard skill directories', async () => {
    const entries = await readdir(path.join(PACKAGE_ROOT, 'skills'), { withFileTypes: true });
    const names = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .toSorted();
    expect(names).toEqual([...EXPECTED_SKILLS].toSorted());
  });

  for (const skill of EXPECTED_SKILLS) {
    it(`${skill} has Agent Skills frontmatter and generated provenance`, async () => {
      const relativePath = `skills/${skill}/SKILL.md`;
      expect(await pathExists(relativePath)).toBe(true);
      const text = await readFile(path.join(PACKAGE_ROOT, relativePath), 'utf-8');
      const frontmatter = parseFrontmatter(text);

      expect(frontmatter.name).toBe(skill);
      expect(frontmatter.description).toBeTruthy();
      expect(text).toContain('Auto-generated from @maestria/core');
      expect(text).not.toMatch(/\$maestria:/u);
      expect(text).not.toMatch(
        /@(?:adventurer|architect|builder|diagnose|orchestrator|planner|reviewer|writer)\b/u,
      );
    });
  }

  it('keeps native runtime names out of the portable projection', async () => {
    const texts = await Promise.all(
      EXPECTED_SKILLS.map(
        async (skill) =>
          await readFile(path.join(PACKAGE_ROOT, 'skills', skill, 'SKILL.md'), 'utf-8'),
      ),
    );
    const portableText = texts.join('\n');

    expect(portableText).not.toMatch(
      /\b(?:OpenCode|Claude Code|Codex CLI|Cursor|Hermes|Kimi Code|Prime Agent)\b/u,
    );
  });
});

describe('package boundary', () => {
  it('publishes only the portable plugin surface and docs', async () => {
    const pkg = await readJson('package.json');
    const files = Array.isArray(pkg.files) ? pkg.files : [];

    for (const entry of ['plugin.json', 'skills', 'README.md', 'INSTALL.md', 'LICENSE']) {
      expect(files).toContain(entry);
    }
    for (const entry of ['agents', 'commands', 'hooks', 'mcp.json']) {
      expect(files).not.toContain(entry);
    }
  });
});
