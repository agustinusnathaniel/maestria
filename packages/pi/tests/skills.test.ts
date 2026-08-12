import { describe, it, expect } from 'vite-plus/test';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const SKILLS_DIR = join(import.meta.dirname, '..', 'skills');

describe('skills', () => {
  const skills = ['handoff', 'iteration-limits'];

  for (const name of skills) {
    it(`${name}/SKILL.md exists and has valid frontmatter`, () => {
      const path = join(SKILLS_DIR, name, 'SKILL.md');
      expect(existsSync(path)).toBe(true);

      const content = readFileSync(path, 'utf-8');
      const match = content.match(/^---\n([\s\S]*?)\n---/);
      expect(match).not.toBeNull();

      const frontmatter = match![1];
      expect(frontmatter).toContain('name:');
      expect(frontmatter).toContain('description:');
    });
  }

  it('all skills have matching directory and frontmatter name', () => {
    for (const name of skills) {
      const path = join(SKILLS_DIR, name, 'SKILL.md');
      const content = readFileSync(path, 'utf-8');
      const nameMatch = content.match(/^name:\s*(\S+)/m);
      expect(nameMatch).not.toBeNull();
      expect(nameMatch![1]).toBe(name);
    }
  });

  it('keeps the direct-capable host semantics in the orchestrator skill', () => {
    const content = readFileSync(join(SKILLS_DIR, 'orchestrator', 'SKILL.md'), 'utf-8');

    expect(content).toContain('Runtime Authority');
    expect(content).toContain('direct work is available');
    expect(content).not.toMatch(/pure dispatcher|Never implement routed code changes yourself/i);
  });
});
