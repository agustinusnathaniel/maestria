import fs, { readdirSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { syncBundledSkills } from '../../../scripts/sync-bundled-skills.js';

const SKILLS_DIR = path.join(import.meta.dirname, '..', '..', '..', 'skills');
const REPO_ROOT = path.join(SKILLS_DIR, '..');

const FRONTMATTER_RE = /^---\n(?<body>[\s\S]*?)\n---/u;
const SKILL_NAME_RE = /^name:\s*(?<name>.+)$/mu;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const normalizeSkillSlug = (skill: string): string =>
  skill.toLowerCase().replaceAll(/[\s_]+/gu, '-');

const readSkillName = (dir: string): string => {
  const content = readFileSync(path.join(SKILLS_DIR, dir, 'SKILL.md'), 'utf-8');
  const frontmatter = FRONTMATTER_RE.exec(content)?.groups?.body ?? '';
  return SKILL_NAME_RE.exec(frontmatter)?.groups?.name?.trim() ?? '';
};

const skillDirs = (): string[] =>
  readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .toSorted();

describe('canonical methodology skills', () => {
  it('name each skill after its directory', () => {
    expect(skillDirs()).toEqual(['create-pull-request', 'docs-update']);
    for (const dir of skillDirs()) {
      expect(readSkillName(dir)).toBe(dir);
    }
  });

  it('lists exactly the skills under skills/ in skills.sh.json groupings', () => {
    const parsed: unknown = JSON.parse(
      readFileSync(path.join(REPO_ROOT, 'skills.sh.json'), 'utf-8'),
    );
    if (!isRecord(parsed) || !Array.isArray(parsed.groupings)) {
      throw new TypeError('skills.sh.json must be an object with a groupings array');
    }
    const grouped = parsed.groupings.flatMap((grouping: unknown) => {
      if (!isRecord(grouping) || typeof grouping.title !== 'string' || grouping.title === '') {
        throw new TypeError('skills.sh.json grouping needs a title');
      }
      return Array.isArray(grouping.skills) ? grouping.skills.map(String) : [];
    });
    expect(grouped.map(normalizeSkillSlug).toSorted()).toEqual(skillDirs());
  });
});

const target = (root: string, name: string): string =>
  path.join(root, 'packages', 'pi', 'skills', name, 'SKILL.md');

describe('bundled skill copies', () => {
  const temporary: string[] = [];
  afterEach(() => {
    for (const root of temporary.splice(0)) {
      fs.rmSync(root, { force: true, recursive: true });
    }
  });

  const fixture = (): string => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maestria-bundled-skills-'));
    temporary.push(root);
    fs.mkdirSync(path.join(root, 'skills', 'demo'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'skills', 'demo', 'SKILL.md'),
      '---\nname: demo\ndescription: Demo skill\n---\n\n# Demo\n\nBody.\n',
    );
    return root;
  };

  it('copies each skill into every package with frontmatter first and a provenance notice', () => {
    const root = fixture();
    syncBundledSkills(root);

    for (const pkg of ['agent-plugins', 'opencode', 'pi']) {
      const copy = readFileSync(path.join(root, 'packages', pkg, 'skills/demo/SKILL.md'), 'utf-8');
      expect(copy).toBe(
        '---\nname: demo\ndescription: Demo skill\n---\n\n' +
          '<!-- Bundled from skills/demo/SKILL.md by scripts/sync-bundled-skills.ts. Do not edit directly. -->\n\n' +
          '# Demo\n\nBody.\n',
      );
    }
    expect(syncBundledSkills(root, true)).toEqual([]);
  });

  it('reports drift in check mode and removes copies whose source skill is gone', () => {
    const root = fixture();
    syncBundledSkills(root);
    fs.appendFileSync(target(root, 'demo'), 'hand edit\n');
    expect(syncBundledSkills(root, true)).toEqual([
      { action: 'write', relative: 'packages/pi/skills/demo/SKILL.md' },
    ]);

    fs.rmSync(path.join(root, 'skills', 'demo'), { recursive: true });
    syncBundledSkills(root);
    expect(fs.existsSync(path.dirname(target(root, 'demo')))).toBe(false);
  });

  it('refuses to overwrite a package-owned skill of the same name', () => {
    const root = fixture();
    fs.mkdirSync(path.dirname(target(root, 'demo')), { recursive: true });
    fs.writeFileSync(target(root, 'demo'), '---\nname: demo\n---\n\nPackage-owned.\n');

    expect(() => syncBundledSkills(root)).toThrow(/would overwrite a package-owned skill/u);
    expect(readFileSync(target(root, 'demo'), 'utf-8')).toContain('Package-owned.');
  });
});
