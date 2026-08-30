import { describe, it, expect, beforeEach, afterEach } from 'vite-plus/test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { validateSkills, validateSkillsAndLog } from '../scripts/lib/skill-validator.js';

function makeSkill(dir: string, name: string, frontmatter: string, body: string): void {
  const skillDir = join(dir, 'skills', name);
  mkdirSync(skillDir, { recursive: true });
  const content = `---\n${frontmatter}\n---\n\n${body}\n`;
  writeFileSync(join(skillDir, 'SKILL.md'), content, 'utf-8');
}

describe('validateSkills', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'maestria-skill-'));
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('passes for valid skills', () => {
    makeSkill(
      tmp,
      'orchestrator',
      'name: orchestrator\ndescription: Orchestrator skill',
      'Body content',
    );
    makeSkill(tmp, 'global-rules', 'name: global-rules\ndescription: Rules', 'Body');
    const result = validateSkills({ root: tmp, skills: ['orchestrator', 'global-rules'] });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.successes).toEqual([
      'skills/orchestrator/SKILL.md',
      'skills/global-rules/SKILL.md',
    ]);
  });

  it('fails for missing file', () => {
    const result = validateSkills({ root: tmp, skills: ['missing'] });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Missing: skills/missing/SKILL.md');
  });

  it('fails for missing frontmatter', () => {
    const dir = join(tmp, 'skills', 'bad');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'SKILL.md'), 'no frontmatter', 'utf-8');
    const result = validateSkills({ root: tmp, skills: ['bad'] });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('missing or invalid frontmatter');
  });

  it('fails for missing name and description', () => {
    makeSkill(tmp, 'bad2', 'name: bad2', 'Body');
    const result = validateSkills({ root: tmp, skills: ['bad2'] });
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => {
        return e.includes('description');
      }),
    ).toBe(true);
  });

  it('fails for empty body', () => {
    const dir = join(tmp, 'skills', 'empty');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'SKILL.md'), '---\nname: empty\ndescription: desc\n---\n', 'utf-8');
    const result = validateSkills({ root: tmp, skills: ['empty'] });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('no body content');
  });

  it('does not fail for Prime stricter helper - this helper is intentionally lenient (Pi/OMP)', () => {
    // Pi/OMP helper only checks presence of name/description, not grammar.
    // Prime's validator (packages/prime-agent/scripts/skill-validation.ts) is stricter.
    makeSkill(tmp, 'weird-name', 'name: weird-name\ndescription: desc', 'Body');
    const result = validateSkills({ root: tmp, skills: ['weird-name'] });
    expect(result.valid).toBe(true);
  });

  it('preserves prior Pi/OMP contract: ✅ emitted even when name/description checks fail (frontmatter exists)', () => {
    makeSkill(tmp, 'bad2', 'name: bad2', 'Body');
    const result = validateSkills({ root: tmp, skills: ['bad2'] });
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => {
        return e.includes('description');
      }),
    ).toBe(true);
    // Success line must still be present when frontmatter exists
    expect(result.successes).toEqual(['skills/bad2/SKILL.md']);
  });

  it('preserves ✅ even when body is empty but frontmatter exists', () => {
    const dir = join(tmp, 'skills', 'empty');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'SKILL.md'), '---\nname: empty\ndescription: desc\n---\n', 'utf-8');
    const result = validateSkills({ root: tmp, skills: ['empty'] });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('no body content');
    expect(result.successes).toEqual(['skills/empty/SKILL.md']);
  });

  it('does not emit ✅ for missing file or invalid frontmatter', () => {
    const dir = join(tmp, 'skills', 'bad');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'SKILL.md'), 'no frontmatter', 'utf-8');
    const r1 = validateSkills({ root: tmp, skills: ['bad'] });
    expect(r1.successes).toEqual([]);
    const r2 = validateSkills({ root: tmp, skills: ['missing'] });
    expect(r2.successes).toEqual([]);
  });

  describe('validateSkillsAndLog stdout/stderr contract', () => {
    function captureLog(fn: () => boolean): { ok: boolean; out: string[]; err: string[] } {
      const out: string[] = [];
      const err: string[] = [];
      const origLog = console.log;
      const origError = console.error;
      // eslint-disable-next-line no-console
      console.log = (...args: unknown[]) => {
        return out.push(args.join(' '));
      };
      console.error = (...args: unknown[]) => {
        return err.push(args.join(' '));
      };
      try {
        const ok = fn();
        return { ok, out, err };
      } finally {
        console.log = origLog;
        console.error = origError;
      }
    }

    it('logs ✅ to stdout for valid skills and returns true', () => {
      makeSkill(tmp, 'orchestrator', 'name: orchestrator\ndescription: Orchestrator skill', 'Body');
      const { ok, out, err } = captureLog(() => {
        return validateSkillsAndLog({ root: tmp, skills: ['orchestrator'] });
      });
      expect(ok).toBe(true);
      expect(out).toEqual(['✅ skills/orchestrator/SKILL.md']);
      expect(err).toEqual([]);
    });

    it('logs ❌ to stderr and still logs ✅ to stdout when frontmatter exists but field missing', () => {
      makeSkill(tmp, 'bad2', 'name: bad2', 'Body');
      const { ok, out, err } = captureLog(() => {
        return validateSkillsAndLog({ root: tmp, skills: ['bad2'] });
      });
      expect(ok).toBe(false);
      expect(
        err.some((m) => {
          return m.includes('❌') && m.includes('description');
        }),
      ).toBe(true);
      expect(out).toEqual(['✅ skills/bad2/SKILL.md']);
    });

    it('logs ❌ to stderr without ✅ for missing file', () => {
      const { ok, out, err } = captureLog(() => {
        return validateSkillsAndLog({ root: tmp, skills: ['missing'] });
      });
      expect(ok).toBe(false);
      expect(out).toEqual([]);
      expect(
        err.some((m) => {
          return m.includes('❌') && m.includes('Missing: skills/missing/SKILL.md');
        }),
      ).toBe(true);
    });

    it('logs ❌ to stderr without ✅ for invalid frontmatter', () => {
      const dir = join(tmp, 'skills', 'bad');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'SKILL.md'), 'no frontmatter', 'utf-8');
      const { ok, out, err } = captureLog(() => {
        return validateSkillsAndLog({ root: tmp, skills: ['bad'] });
      });
      expect(ok).toBe(false);
      expect(out).toEqual([]);
      expect(
        err.some((m) => {
          return m.includes('❌') && m.includes('missing or invalid frontmatter');
        }),
      ).toBe(true);
    });
  });
});
