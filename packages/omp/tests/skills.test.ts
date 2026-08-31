import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vite-plus/test';

const SKILLS_DIR = path.join(import.meta.dirname, '..', 'skills');

describe('skills', () => {
  // Manually-authored skills specific to the omp plugin
  const manualSkills = ['handoff', 'iteration-limits'];
  // Skills synced from packages/core/agent-directives via the sync pipeline
  const syncedSkills = ['global-rules', 'orchestrator'];
  const skills = [...manualSkills, ...syncedSkills];

  for (const name of skills) {
    it(`${name}/SKILL.md exists and has valid frontmatter`, () => {
      const skillPath = path.join(SKILLS_DIR, name, 'SKILL.md');
      expect(existsSync(skillPath)).toBe(true);

      const content = readFileSync(skillPath, 'utf-8');
      const match = /^---\n(?<frontmatter>[\s\S]*?)\n---/u.exec(content);
      const frontmatter = match?.groups?.frontmatter;
      if (frontmatter === undefined || frontmatter === '') {
        throw new Error(`Missing frontmatter in ${skillPath}`);
      }

      expect(frontmatter).toContain('name:');
      expect(frontmatter).toContain('description:');
    });
  }

  it('all skills have matching directory and frontmatter name', () => {
    for (const name of skills) {
      const skillPath = path.join(SKILLS_DIR, name, 'SKILL.md');
      const content = readFileSync(skillPath, 'utf-8');
      const nameMatch = /^name:\s*(?<name>\S+)/mu.exec(content);
      if (nameMatch?.groups?.name === undefined) {
        throw new Error(`Missing name in ${skillPath}`);
      }
      expect(nameMatch.groups.name).toBe(name);
    }
  });

  it('keeps the orchestrator capability-aware while active modes use runtime enforcement', () => {
    const text = readFileSync(path.join(SKILLS_DIR, 'orchestrator', 'SKILL.md'), 'utf-8');

    expect(text).toContain('Runtime Authority');
    expect(text).toContain('direct work is unavailable or disallowed');
    expect(text).toContain('direct work is available');
    expect(text).not.toMatch(
      /\b(?<platform>OpenCode|OMP|Kimi Code|Hermes|Cursor|Claude Code|Pi)\b/u,
    );
  });
});
