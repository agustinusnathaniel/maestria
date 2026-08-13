import { describe, it, expect } from 'vite-plus/test';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import syncConfig from '../sync.config.js';
import {
  DESCRIPTION_MAX,
  NAME_MAX,
  isValidSkillName,
  frontmatterValue,
} from '../scripts/skill-validation.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, '..');

const SKILLS_DIR = path.join(PACKAGE_ROOT, 'skills');

// The 14 skills this package projects from canonical directives.
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

interface PackageJson {
  name?: string;
  files?: string[];
}

async function readJson<T>(relativePath: string): Promise<T> {
  const absolute = path.join(PACKAGE_ROOT, relativePath);
  const raw = await readFile(absolute, 'utf8');
  return JSON.parse(raw) as T;
}

async function pathExists(absolutePath: string): Promise<boolean> {
  try {
    await stat(absolutePath);
    return true;
  } catch {
    return false;
  }
}

/** Lists a directory's entries (excluding dotfiles) in sorted order. */
async function readDirNames(relativePath: string): Promise<string[]> {
  const entries = await readdir(path.join(PACKAGE_ROOT, relativePath), {
    withFileTypes: true,
  });
  return entries
    .filter((entry) => !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort();
}

/**
 * Minimal YAML frontmatter parser for the subset used by generated files
 * (scalars only). Matches the repository test convention; the generated
 * frontmatter contains only `name` and `description`.
 */
function parseFrontmatter(text: string): { data: Record<string, string>; body: string } {
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== '---') {
    throw new Error('missing opening frontmatter fence');
  }
  const close = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (close === -1) {
    throw new Error('missing closing frontmatter fence');
  }

  const data: Record<string, string> = {};
  for (const line of lines.slice(1, close)) {
    const pair = /^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/.exec(line);
    if (pair === null) continue;
    const [, key, rawValue] = pair;
    const value = rawValue.trim();
    if (value === '' || value.startsWith('|')) {
      // Block scalar (| or |-): collect the indented continuation lines.
      const body: string[] = [];
      for (const l of lines.slice(1, close)) {
        if (/^\s{2}/.test(l)) body.push(l.trim());
      }
      data[key] = body.join(' ');
      continue;
    }
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      data[key] = value.slice(1, -1);
    } else {
      data[key] = value;
    }
  }
  const body = lines.slice(close + 1).join('\n');
  return { data, body };
}

async function readSkill(name: string): Promise<{ data: Record<string, string>; body: string }> {
  const text = await readFile(path.join(SKILLS_DIR, name, 'SKILL.md'), 'utf8');
  return parseFrontmatter(text);
}

describe('generated Prime Agent skills', () => {
  it('contains exactly the 14 expected skills and nothing else', async () => {
    const names = await readDirNames('skills');
    expect(names).toEqual([...EXPECTED_SKILLS].sort());
  });

  for (const skill of EXPECTED_SKILLS) {
    describe(`${skill}/SKILL.md`, () => {
      it('has a name matching the parent directory and the Agent Skills name rules', async () => {
        const { data } = await readSkill(skill);
        expect(data.name).toBe(skill);
        expect(isValidSkillName(skill)).toBe(true);
      });

      it('has a required, non-empty description within the documented length', async () => {
        const { data } = await readSkill(skill);
        expect(typeof data.description).toBe('string');
        const description = (data.description ?? '').trim();
        expect(description.length).toBeGreaterThan(0);
        expect(description.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
      });

      it('has a non-empty body, the auto-generated comment, and no source comment', async () => {
        const text = await readFile(path.join(SKILLS_DIR, skill, 'SKILL.md'), 'utf8');
        const { body } = parseFrontmatter(text);
        expect(body.trim().length).toBeGreaterThan(0);
        expect(text).toContain('Auto-generated from @maestria/core');
        expect(text).not.toMatch(/^<!--\s*Source:/m);
      });

      it('never uses recursive-subagent call syntax (rlm(...))', async () => {
        const text = await readFile(path.join(SKILLS_DIR, skill, 'SKILL.md'), 'utf8');
        expect(text).not.toMatch(/rlm\s*\(/);
      });

      it('mentions JSON/RPC/headless/subagent dispatch only inside denials, never as available', async () => {
        const text = await readFile(path.join(SKILLS_DIR, skill, 'SKILL.md'), 'utf8');
        const sentences = text.split(/(?<=[.!?])\s+/);
        for (const sentence of sentences) {
          if (/(JSON|RPC|headless|rlm|subagent\s+dispatch|spawns?)/i.test(sentence)) {
            expect(sentence).toMatch(/(no|not) |deferred/i);
          }
        }
      });

      it('has no unresolved specialist mention references', async () => {
        const text = await readFile(path.join(SKILLS_DIR, skill, 'SKILL.md'), 'utf8');
        for (const mention of [
          'adventurer',
          'architect',
          'builder',
          'diagnose',
          'planner',
          'reviewer',
          'writer',
          'orchestrator',
        ]) {
          expect(text).not.toMatch(new RegExp(`@${mention}(?!:)`));
        }
      });
    });
  }
});

describe('Agent Skills name grammar and frontmatter normalization', () => {
  // Negative-path coverage for the exact grammar the validator enforces
  // (shared from scripts/skill-validation.ts): 1-64 characters, lowercase
  // a-z/0-9/hyphens, no leading/trailing or consecutive hyphens; quoted
  // scalars are validated by their actual value.

  it('rejects a trailing hyphen', () => {
    expect(isValidSkillName('builder-')).toBe(false);
  });

  it('rejects a leading hyphen', () => {
    expect(isValidSkillName('-builder')).toBe(false);
  });

  it('rejects consecutive hyphens', () => {
    expect(isValidSkillName('build--er')).toBe(false);
  });

  it('rejects a name longer than 64 characters', () => {
    expect(isValidSkillName('a'.repeat(NAME_MAX + 1))).toBe(false);
  });

  it('accepts boundary-length valid names (1 and 64 characters)', () => {
    expect(isValidSkillName('a')).toBe(true);
    expect(isValidSkillName(`${'a'.repeat(NAME_MAX - 1)}b`)).toBe(true);
  });

  it('treats a quoted empty description as empty', () => {
    expect(frontmatterValue('name: builder\ndescription: ""', 'description')).toBe('');
  });

  it('treats a quoted whitespace-only description as empty', () => {
    expect(frontmatterValue('name: builder\ndescription: "   "', 'description')).toBe('');
  });

  it('validates a quoted name by its actual value', () => {
    expect(frontmatterValue("name: 'builder'\ndescription: Builds things", 'name')).toBe('builder');
  });
});

describe('content invariants', () => {
  it('keeps the direct-capable host semantics in the orchestrator skill', async () => {
    const text = await readFile(path.join(SKILLS_DIR, 'orchestrator', 'SKILL.md'), 'utf8');
    expect(text).toContain('Runtime Authority');
    expect(text).toContain('direct work is available');
    expect(text).not.toMatch(/pure dispatcher|Never implement routed code changes yourself/i);
  });

  it('frames the orchestrator delivery honestly: advisory, not a sandbox, extension deferred', async () => {
    const text = await readFile(path.join(SKILLS_DIR, 'orchestrator', 'SKILL.md'), 'utf8');
    expect(text).toContain('skills-first package');
    expect(text).toContain('not a sandbox');
    expect(text).toContain('advisory guidance');
    expect(text).toContain('executable extension is deferred');
    expect(text).toContain('`global-rules` skill');
    expect(text).toContain('`fein`');
    expect(text).toContain('`sonar`');
    expect(text).toContain('`blitz`');
  });

  it('generates the global-rules skill from canonical rules with the Prime heading', async () => {
    const text = await readFile(path.join(SKILLS_DIR, 'global-rules', 'SKILL.md'), 'utf8');
    expect(text).toContain('# Global Agent Rules - @maestria/prime-agent');
    expect(text).toContain('Universal Floors');
    expect(text).toContain('Prime Agent Integration');
    expect(text).toContain('not a sandbox');
  });

  it('frames read-only roles as advisory, never as runtime-enforced', async () => {
    for (const role of ['adventurer', 'planner', 'reviewer']) {
      const text = await readFile(path.join(SKILLS_DIR, role, 'SKILL.md'), 'utf8');
      expect(text).toContain('Read-only role (advisory)');
      expect(text).toContain('no runtime tool enforcement');
      expect(text).not.toMatch(/tools are denied|disallowed/i);
    }
  });

  it('projects the workflow modes as skills with mode semantics intact', async () => {
    for (const mode of ['fein', 'sonar', 'blitz']) {
      const text = await readFile(path.join(SKILLS_DIR, mode, 'SKILL.md'), 'utf8');
      expect(text).toContain(`## MODE: ${mode}`);
      expect(text).toContain('orchestrator');
    }
  });
});

describe('sync config source mapping', () => {
  // Every canonical source this package projects, with the skill output it must
  // emit. Reads the live config (the unit under test), so the source/output
  // pairs are asserted rather than duplicated from generated output.
  const EXPECTED_OUTPUTS: Record<string, string> = {
    'adventurer.md': 'adventurer/SKILL.md',
    'architect.md': 'architect/SKILL.md',
    'builder.md': 'builder/SKILL.md',
    'diagnose.md': 'diagnose/SKILL.md',
    'planner.md': 'planner/SKILL.md',
    'reviewer.md': 'reviewer/SKILL.md',
    'writer.md': 'writer/SKILL.md',
    'orchestrator.md': 'orchestrator/SKILL.md',
    'rules.md': 'global-rules/SKILL.md',
    'skills/handoff.md': 'handoff/SKILL.md',
    'skills/iteration-limits.md': 'iteration-limits/SKILL.md',
    'commands/fein.md': 'fein/SKILL.md',
    'commands/sonar.md': 'sonar/SKILL.md',
    'commands/blitz.md': 'blitz/SKILL.md',
  };

  it('maps every intended canonical source to its expected skill output', () => {
    const files = (syncConfig.files ?? {}) as Record<string, { output?: string }>;
    for (const [source, output] of Object.entries(EXPECTED_OUTPUTS)) {
      expect(files[source]?.output).toBe(output);
    }
  });
});

describe('package boundary', () => {
  it('has the exact package identity "@maestria/prime-agent"', async () => {
    const pkg = await readJson<PackageJson>('package.json');
    expect(pkg.name).toBe('@maestria/prime-agent');
  });

  it('ships skills but no executable surface (no agents/, hooks/, dist/)', async () => {
    expect(await pathExists(path.join(PACKAGE_ROOT, 'agents'))).toBe(false);
    expect(await pathExists(path.join(PACKAGE_ROOT, 'hooks'))).toBe(false);
    expect(await pathExists(path.join(PACKAGE_ROOT, 'commands'))).toBe(false);
  });

  it('allowlists only the skills projection and docs for packaging', async () => {
    const pkg = await readJson<PackageJson>('package.json');
    for (const entry of ['skills', 'README.md', 'INSTALL.md', 'LICENSE']) {
      expect(pkg.files).toContain(entry);
    }
    expect(pkg.files).not.toContain('agents');
    expect(pkg.files).not.toContain('hooks');
    expect(pkg.files).not.toContain('dist');
  });
});
