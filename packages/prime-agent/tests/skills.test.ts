import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vite-plus/test';

import {
  DESCRIPTION_MAX,
  frontmatterValue,
  isValidSkillName,
  NAME_MAX,
} from '../scripts/skill-validation.ts';
import syncConfig from '../sync.config.js';

const __dirname = import.meta.dirname;
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
  pi?: { extensions?: string[]; skills?: string[] };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const isPiManifest = (value: unknown): value is NonNullable<PackageJson['pi']> => {
  if (!isRecord(value)) {
    return false;
  }
  return (
    (value.extensions === undefined || isStringArray(value.extensions)) &&
    (value.skills === undefined || isStringArray(value.skills))
  );
};

const isPackageJson = (value: unknown): value is PackageJson => {
  if (!isRecord(value)) {
    return false;
  }
  return (
    (value.name === undefined || typeof value.name === 'string') &&
    (value.files === undefined || isStringArray(value.files)) &&
    (value.pi === undefined || isPiManifest(value.pi))
  );
};

const readJson = async (relativePath: string): Promise<PackageJson> => {
  const absolute = path.join(PACKAGE_ROOT, relativePath);
  const raw = await readFile(absolute, 'utf-8');
  const value: unknown = JSON.parse(raw);
  if (!isPackageJson(value)) {
    throw new Error(`${relativePath} does not contain a valid package manifest`);
  }
  return value;
};

const pathExists = async (absolutePath: string): Promise<boolean> => {
  try {
    await stat(absolutePath);
    return true;
  } catch {
    return false;
  }
};

/** Lists a directory's entries (excluding dotfiles) in sorted order. */
const readDirNames = async (relativePath: string): Promise<string[]> => {
  const entries = await readdir(path.join(PACKAGE_ROOT, relativePath), {
    withFileTypes: true,
  });
  return entries
    .filter((entry) => !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .toSorted();
};

/**
 * Minimal YAML frontmatter parser for the subset used by generated files
 * (scalars only). Matches the repository test convention; the generated
 * frontmatter contains only `name` and `description`.
 */
const parseFrontmatter = (text: string): { data: Record<string, string>; body: string } => {
  const lines = text.split(/\r?\n/u);
  if (lines[0]?.trim() !== '---') {
    throw new Error('missing opening frontmatter fence');
  }
  const close = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (close === -1) {
    throw new Error('missing closing frontmatter fence');
  }

  const data: Record<string, string> = {};
  for (const line of lines.slice(1, close)) {
    const pair = /^(?<key>[A-Za-z][A-Za-z0-9_-]*):\s*(?<rawValue>.*)$/u.exec(line);
    if (pair === null) {
      continue;
    }
    const { groups } = pair;
    if (groups === undefined) {
      continue;
    }
    const { key, rawValue } = groups;
    const value = rawValue.trim();
    if (value === '' || value.startsWith('|')) {
      // Block scalar (| or |-): collect the indented continuation lines.
      const body: string[] = [];
      for (const l of lines.slice(1, close)) {
        if (/^\s{2}/u.test(l)) {
          body.push(l.trim());
        }
      }
      data[key] = body.join(' ');
      continue;
    }
    data[key] =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
        ? value.slice(1, -1)
        : value;
  }
  const body = lines.slice(close + 1).join('\n');
  return { body, data };
};

const readSkill = async (name: string): Promise<{ data: Record<string, string>; body: string }> => {
  const text = await readFile(path.join(SKILLS_DIR, name, 'SKILL.md'), 'utf-8');
  return parseFrontmatter(text);
};

describe('generated Prime Agent skills', () => {
  it('contains exactly the 14 expected skills and nothing else', async () => {
    const names = await readDirNames('skills');
    expect(names).toEqual([...EXPECTED_SKILLS].toSorted());
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
        const text = await readFile(path.join(SKILLS_DIR, skill, 'SKILL.md'), 'utf-8');
        const { body } = parseFrontmatter(text);
        expect(body.trim().length).toBeGreaterThan(0);
        expect(text).toContain('Auto-generated from @maestria/core');
        expect(text).not.toMatch(/^<!--\s*Source:/mu);
      });

      it('never uses recursive-subagent call syntax (rlm(...))', async () => {
        const text = await readFile(path.join(SKILLS_DIR, skill, 'SKILL.md'), 'utf-8');
        expect(text).not.toMatch(/rlm\s*\(/u);
      });

      it('mentions JSON/RPC/headless/subagent dispatch only inside denials, never as available', async () => {
        const text = await readFile(path.join(SKILLS_DIR, skill, 'SKILL.md'), 'utf-8');
        const sentences = text.split(/(?<=[.!?])\s+/u);
        for (const sentence of sentences) {
          if (/(?:JSON|RPC|headless|rlm|subagent\s+dispatch|spawns?)/iu.test(sentence)) {
            expect(sentence).toMatch(/(?:no|not) |deferred/iu);
          }
        }
      });

      it('has no unresolved specialist mention references', async () => {
        const text = await readFile(path.join(SKILLS_DIR, skill, 'SKILL.md'), 'utf-8');
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
          expect(text).not.toMatch(new RegExp(`@${mention}(?!:)`, 'u'));
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
    const text = await readFile(path.join(SKILLS_DIR, 'orchestrator', 'SKILL.md'), 'utf-8');
    expect(text).toContain('Runtime Authority');
    expect(text).toContain('direct work is available');
    expect(text).not.toMatch(/pure dispatcher|Never implement routed code changes yourself/iu);
  });

  it('frames the orchestrator delivery honestly: advisory, not a sandbox, rlm/JSON-RPC deferred', async () => {
    const text = await readFile(path.join(SKILLS_DIR, 'orchestrator', 'SKILL.md'), 'utf-8');
    expect(text).toContain('skills-first package');
    expect(text).toContain('not a sandbox');
    expect(text).toContain('advisory guidance');
    // Verified executable subset: mode commands + mode prompt injection.
    expect(text).toContain('`pi.extensions`');
    expect(text).toContain('`/fein`');
    expect(text).toContain('`/mode-clear`');
    expect(text).toContain('before_agent_start');
    expect(text).toContain('mode prompt injection');
    // Deferred: recursive-subagent dispatch and JSON/RPC headless mode.
    expect(text).toContain('Deferred: recursive-subagent dispatch');
    expect(text).toContain('are NOT provided');
    expect(text).not.toMatch(/rlm\s*\(/u);
    expect(text).toContain('`global-rules` skill');
    expect(text).toContain('`fein`');
    expect(text).toContain('`sonar`');
    expect(text).toContain('`blitz`');
  });

  it('generates the global-rules skill from canonical rules with the Prime heading', async () => {
    const text = await readFile(path.join(SKILLS_DIR, 'global-rules', 'SKILL.md'), 'utf-8');
    expect(text).toContain('# Global Agent Rules - @maestria/prime-agent');
    expect(text).toContain('Universal Floors');
    expect(text).toContain('Prime Agent Integration');
    expect(text).toContain('not a sandbox');
  });

  it('frames read-only roles as advisory, never as runtime-enforced', async () => {
    const texts = await Promise.all(
      ['adventurer', 'planner', 'reviewer'].map(
        async (role) => await readFile(path.join(SKILLS_DIR, role, 'SKILL.md'), 'utf-8'),
      ),
    );
    for (const text of texts) {
      expect(text).toContain('Read-only role (advisory)');
      expect(text).toContain('no runtime tool enforcement');
      expect(text).not.toMatch(/tools are denied|disallowed/iu);
    }
  });

  it('projects the workflow modes as skills with mode semantics intact', async () => {
    const modes = ['fein', 'sonar', 'blitz'] as const;
    const texts = await Promise.all(
      modes.map(async (mode) => ({
        mode,
        text: await readFile(path.join(SKILLS_DIR, mode, 'SKILL.md'), 'utf-8'),
      })),
    );
    for (const { mode, text } of texts) {
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
    'commands/blitz.md': 'blitz/SKILL.md',
    'commands/fein.md': 'fein/SKILL.md',
    'commands/sonar.md': 'sonar/SKILL.md',
    'diagnose.md': 'diagnose/SKILL.md',
    'orchestrator.md': 'orchestrator/SKILL.md',
    'planner.md': 'planner/SKILL.md',
    'reviewer.md': 'reviewer/SKILL.md',
    'rules.md': 'global-rules/SKILL.md',
    'skills/handoff.md': 'handoff/SKILL.md',
    'skills/iteration-limits.md': 'iteration-limits/SKILL.md',
    'writer.md': 'writer/SKILL.md',
  };

  it('maps every intended canonical source to its expected skill output', () => {
    const files: Record<string, { output?: string }> = syncConfig.files ?? {};
    for (const [source, output] of Object.entries(EXPECTED_OUTPUTS)) {
      expect(files[source]?.output).toBe(output);
    }
  });
});

describe('package boundary', () => {
  it('has the exact package identity "@maestria/prime-agent"', async () => {
    const pkg = await readJson('package.json');
    expect(pkg.name).toBe('@maestria/prime-agent');
  });

  it('has no agents/, hooks/, or commands/ directories (no subagent/agent-tool surface)', async () => {
    expect(await pathExists(path.join(PACKAGE_ROOT, 'agents'))).toBe(false);
    expect(await pathExists(path.join(PACKAGE_ROOT, 'hooks'))).toBe(false);
    expect(await pathExists(path.join(PACKAGE_ROOT, 'commands'))).toBe(false);
  });

  it('allowlists the skills projection, the compiled extension, and docs for packaging', async () => {
    const pkg = await readJson('package.json');
    for (const entry of ['dist', 'skills', 'README.md', 'INSTALL.md', 'LICENSE']) {
      expect(pkg.files).toContain(entry);
    }
    expect(pkg.files).not.toContain('agents');
    expect(pkg.files).not.toContain('hooks');
  });

  it('declares the compiled extension and skills under the pi manifest key', async () => {
    const pkg = await readJson('package.json');
    expect(pkg.pi?.extensions).toContain('./dist/extension.mjs');
    expect(pkg.pi?.skills).toContain('./skills');
  });
});
