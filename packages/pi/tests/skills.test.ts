import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vite-plus/test';

const SKILLS_DIR = path.join(import.meta.dirname, '..', 'skills');

describe('skills', () => {
  const skills = ['handoff', 'iteration-limits'];

  for (const name of skills) {
    it(`${name}/SKILL.md exists and has valid frontmatter`, () => {
      const skillPath = path.join(SKILLS_DIR, name, 'SKILL.md');
      expect(existsSync(skillPath)).toBe(true);

      const content = readFileSync(skillPath, 'utf-8');
      const match = /^---\n(?<frontmatter>[\s\S]*?)\n---/u.exec(content);
      const frontmatter = match?.groups?.frontmatter;
      expect(frontmatter).toBeDefined();

      expect(frontmatter).toContain('name:');
      expect(frontmatter).toContain('description:');
    });
  }

  it('all skills have matching directory and frontmatter name', () => {
    for (const name of skills) {
      const skillPath = path.join(SKILLS_DIR, name, 'SKILL.md');
      const content = readFileSync(skillPath, 'utf-8');
      const nameMatch = /^name:\s*(?<name>\S+)/mu.exec(content);
      expect(nameMatch?.groups?.name).toBe(name);
    }
  });
});
