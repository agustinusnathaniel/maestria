import { describe, it, expect } from 'vite-plus/test';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const SKILLS_DIR = join(import.meta.dirname, '..', 'skills');

describe('skills', () => {
  // Manually-authored skills specific to the omp plugin
  const manualSkills = ['handoff', 'iteration-limits'];
  // Skills synced from packages/core/agent-directives via the sync pipeline
  const syncedSkills = ['global-rules', 'orchestrator'];
  const skills = [...manualSkills, ...syncedSkills];

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
});
