import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vite-plus/test';

const SKILLS_DIR = path.join(import.meta.dirname, '..', '..', '..', 'skills');
const REPO_ROOT = path.join(SKILLS_DIR, '..');

const FRONTMATTER_RE = /^---\n(?<body>[\s\S]*?)\n---/u;
const SKILL_NAME_RE = /^name:\s*(?<name>.+)$/mu;
const RELATIVE_PREFIX_RE = /^\.\//u;

interface StandaloneSkillsManifest {
  name: string;
  skills: string[];
}

const isManifest = (value: unknown): value is StandaloneSkillsManifest => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const { name, skills } = value as { name?: unknown; skills?: unknown };
  return (
    name === 'maestria-skills' &&
    Array.isArray(skills) &&
    skills.every((entry) => typeof entry === 'string')
  );
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const normalizeSkillSlug = (skill: string): string =>
  skill.toLowerCase().replaceAll(/[\s_]+/gu, '-');

const readSkillName = (dir: string): string => {
  const content = readFileSync(path.join(SKILLS_DIR, dir, 'SKILL.md'), 'utf-8');
  const frontmatter = FRONTMATTER_RE.exec(content)?.groups?.body ?? '';
  return SKILL_NAME_RE.exec(frontmatter)?.groups?.name?.trim() ?? '';
};

describe('standalone skills plugin manifest', () => {
  it('lists exactly the skill directories under skills/', () => {
    const parsed: unknown = JSON.parse(
      readFileSync(path.join(SKILLS_DIR, '.claude-plugin', 'plugin.json'), 'utf-8'),
    );
    expect(isManifest(parsed)).toBe(true);
    if (!isManifest(parsed)) {
      throw new Error('skills plugin manifest has an unexpected shape');
    }

    const registered = parsed.skills
      .map((entry) => entry.replace(RELATIVE_PREFIX_RE, ''))
      .toSorted();
    const onDisk = readdirSync(SKILLS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => existsSync(path.join(SKILLS_DIR, name, 'SKILL.md')))
      .toSorted();

    expect(registered).toEqual(onDisk);

    for (const dir of onDisk) {
      expect(readSkillName(dir)).toBe(dir);
    }
  });

  it('lists only installed skills in skills.sh.json groupings', () => {
    const parsed: unknown = JSON.parse(
      readFileSync(path.join(REPO_ROOT, 'skills.sh.json'), 'utf-8'),
    );
    expect(isRecord(parsed)).toBe(true);
    if (!isRecord(parsed)) {
      throw new TypeError('skills.sh.json must be a JSON object');
    }
    const groupings: unknown = parsed.groupings;
    expect(Array.isArray(groupings)).toBe(true);
    if (!Array.isArray(groupings)) {
      throw new TypeError('skills.sh.json groupings must be an array');
    }
    expect(groupings.length).toBeGreaterThan(0);

    const onDisk = new Set(
      readdirSync(SKILLS_DIR, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name.toLowerCase()),
    );

    for (const grouping of groupings) {
      if (!isRecord(grouping)) {
        throw new TypeError('skills.sh.json grouping must be an object');
      }
      const title: unknown = grouping.title;
      const skills: unknown = grouping.skills;
      expect(typeof title === 'string' && title.trim().length > 0).toBe(true);
      expect(Array.isArray(skills) && skills.length > 0).toBe(true);
      if (!Array.isArray(skills)) {
        throw new TypeError('skills.sh.json grouping skills must be an array');
      }
      for (const skill of skills) {
        expect(typeof skill === 'string').toBe(true);
        if (typeof skill !== 'string') {
          continue;
        }
        const dir = normalizeSkillSlug(skill);
        expect(onDisk.has(dir)).toBe(true);
        expect(readSkillName(dir)).toBe(dir);
      }
    }
  });
});
