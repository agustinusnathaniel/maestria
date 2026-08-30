import { describe, it, expect } from 'vite-plus/test';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

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
      const match = /^---\n([\s\S]*?)\n---/u.exec(content);
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
      const nameMatch = /^name:\s*(\S+)/mu.exec(content);
      expect(nameMatch).not.toBeNull();
      expect(nameMatch![1]).toBe(name);
    }
  });

  it('keeps the orchestrator capability-aware while active modes use runtime enforcement', () => {
    const text = readFileSync(join(SKILLS_DIR, 'orchestrator', 'SKILL.md'), 'utf-8');

    expect(text).toContain('Runtime Authority');
    expect(text).toContain('direct work is unavailable or disallowed');
    expect(text).toContain('direct work is available');
    expect(text).not.toMatch(/\b(OpenCode|OMP|Kimi Code|Hermes|Cursor|Claude Code|Pi)\b/u);
  });
});
