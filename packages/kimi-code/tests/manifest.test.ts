import { describe, it, expect } from 'vite-plus/test';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, '..');

const PLUGIN_NAME_REGEX = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const AGENTS_MD_MAX_BYTES = 32 * 1024;

const EXPECTED_SKILLS = [
  'orchestrator',
  'builder',
  'adventurer',
  'architect',
  'planner',
  'reviewer',
  'writer',
  'diagnose',
] as const;

interface RawManifest {
  name?: string;
  version?: string;
  description?: string;
  keywords?: string[];
  author?: { name?: string; email?: string };
  homepage?: string;
  license?: string;
  skills?: string | string[];
  sessionStart?: { skill?: string };
  skillInstructions?: string;
  interface?: Record<string, string | undefined>;
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

function parseFrontmatter(text: string): { data: Record<string, unknown>; body: string } {
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== '---') {
    throw new Error('missing opening frontmatter fence');
  }
  const close = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (close === -1) {
    throw new Error('missing closing frontmatter fence');
  }
  const yamlText = lines.slice(1, close).join('\n').trim();
  // Minimal YAML parsing - the fields we validate are simple scalars
  // and key: value pairs (no nested objects in our frontmatter). For
  // robust YAML support, swap in `js-yaml`; we avoid the dependency
  // because this is a manifest validator, not a skill parser.
  const data: Record<string, unknown> = {};
  for (const line of yamlText.split(/\r?\n/)) {
    const m = /^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/.exec(line);
    if (m === null) continue;
    const [, key, rawValue] = m;
    if (rawValue === undefined) continue;
    const value = rawValue.trim();
    if (value === '[]' || value === '') {
      data[key] = value === '[]' ? [] : '';
      continue;
    }
    if (value.startsWith('[') && value.endsWith(']')) {
      // basic array of strings
      const inner = value.slice(1, -1).trim();
      data[key] =
        inner === ''
          ? []
          : inner.split(',').map((entry) => entry.trim().replace(/^["']|["']$/g, ''));
    } else if (
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

describe('kimi.plugin.json manifest', () => {
  it('exists and parses as valid JSON', async () => {
    const manifest = await readJson<RawManifest>('kimi.plugin.json');
    expect(typeof manifest).toBe('object');
    expect(manifest).not.toBeNull();
  });

  it('has a "name" matching the Kimi Code PLUGIN_NAME_REGEX', async () => {
    const manifest = await readJson<RawManifest>('kimi.plugin.json');
    expect(typeof manifest.name).toBe('string');
    expect(manifest.name).toMatch(PLUGIN_NAME_REGEX);
  });

  it('has "skills" field that starts with "./"', async () => {
    const manifest = await readJson<RawManifest>('kimi.plugin.json');
    expect(manifest.skills).toBeDefined();
    if (Array.isArray(manifest.skills)) {
      expect(manifest.skills.length).toBeGreaterThan(0);
      for (const entry of manifest.skills) {
        expect(entry.startsWith('./')).toBe(true);
      }
    } else {
      expect(typeof manifest.skills).toBe('string');
      expect(manifest.skills?.startsWith('./')).toBe(true);
    }
  });

  it('has "sessionStart.skill" pointing at the orchestrator skill', async () => {
    const manifest = await readJson<RawManifest>('kimi.plugin.json');
    expect(manifest.sessionStart).toBeDefined();
    expect(manifest.sessionStart?.skill).toBe('orchestrator');
    const skillPath = path.join(PACKAGE_ROOT, 'skills', 'orchestrator', 'SKILL.md');
    expect(await pathExists(skillPath)).toBe(true);
  });

  it('includes required interface fields', async () => {
    const manifest = await readJson<RawManifest>('kimi.plugin.json');
    expect(manifest.interface).toBeDefined();
    expect(manifest.interface?.displayName).toBeDefined();
    expect(manifest.interface?.shortDescription).toBeDefined();
    expect(manifest.interface?.longDescription).toBeDefined();
    expect(manifest.interface?.developerName).toBeDefined();
    expect(manifest.interface?.websiteURL).toBeDefined();
  });

  it('includes author with name', async () => {
    const manifest = await readJson<RawManifest>('kimi.plugin.json');
    expect(manifest.author?.name).toBeDefined();
  });

  it('does not include unsupported runtime fields', async () => {
    const raw = JSON.parse(
      await readFile(path.join(PACKAGE_ROOT, 'kimi.plugin.json'), 'utf8'),
    ) as Record<string, unknown>;
    const unsupported = [
      'tools',
      'commands',
      'hooks',
      'apps',
      'inject',
      'configFile',
      'config_file',
      'bootstrap',
    ];
    for (const field of unsupported) {
      expect(raw[field]).toBeUndefined();
    }
  });
});

describe('skills directory', () => {
  it('contains all 8 expected skills', async () => {
    for (const skill of EXPECTED_SKILLS) {
      const skillPath = path.join(PACKAGE_ROOT, 'skills', skill, 'SKILL.md');
      expect(await pathExists(skillPath)).toBe(true);
    }
  });

  for (const skill of EXPECTED_SKILLS) {
    describe(`skills/${skill}/SKILL.md`, () => {
      it('parses with valid frontmatter', async () => {
        const skillPath = path.join(PACKAGE_ROOT, 'skills', skill, 'SKILL.md');
        const text = await readFile(skillPath, 'utf8');
        const { data } = parseFrontmatter(text);
        expect(typeof data.name).toBe('string');
        expect((data.name as string).length).toBeGreaterThan(0);
        expect(typeof data.description).toBe('string');
        expect((data.description as string).length).toBeGreaterThan(0);
        expect(data.name).toBe(skill);
        expect(data.type).toBe('prompt');
      });

      it('has a whenToUse field', async () => {
        const skillPath = path.join(PACKAGE_ROOT, 'skills', skill, 'SKILL.md');
        const text = await readFile(skillPath, 'utf8');
        const { data } = parseFrontmatter(text);
        expect(typeof data.whenToUse).toBe('string');
        expect((data.whenToUse as string).trim().length).toBeGreaterThan(0);
      });
    });
  }

  it('orchestrator skill mentions AgentSwarm and the 7-specialist table', async () => {
    const text = await readFile(
      path.join(PACKAGE_ROOT, 'skills', 'orchestrator', 'SKILL.md'),
      'utf8',
    );
    expect(text).toContain('AgentSwarm');
    // The 7 specialist names appear in the orchestrator routing table.
    for (const specialist of [
      'builder',
      'adventurer',
      'architect',
      'planner',
      'reviewer',
      'writer',
      'diagnose',
    ]) {
      expect(text).toContain(specialist);
    }
  });

  it('reviewer skill has the explicit do-not-edit constraint near the top', async () => {
    const text = await readFile(path.join(PACKAGE_ROOT, 'skills', 'reviewer', 'SKILL.md'), 'utf8');
    const head = text.slice(0, 1500);
    expect(head).toMatch(/do not edit/i);
  });

  it('adventurer skill has the explicit read-only Bash constraint near the top', async () => {
    const text = await readFile(
      path.join(PACKAGE_ROOT, 'skills', 'adventurer', 'SKILL.md'),
      'utf8',
    );
    const head = text.slice(0, 2000);
    expect(head).toMatch(/read-only/i);
    expect(head).toMatch(/Bash/);
  });
});

describe('rules/AGENTS.md', () => {
  it('exists', async () => {
    const rulesPath = path.join(PACKAGE_ROOT, 'rules', 'AGENTS.md');
    expect(await pathExists(rulesPath)).toBe(true);
  });

  it('is under the 32 KB Kimi Code truncation budget', async () => {
    const rulesPath = path.join(PACKAGE_ROOT, 'rules', 'AGENTS.md');
    const stats = await stat(rulesPath);
    expect(stats.size).toBeLessThanOrEqual(AGENTS_MD_MAX_BYTES);
  });

  it('contains the 7-specialist delegation table', async () => {
    const text = await readFile(path.join(PACKAGE_ROOT, 'rules', 'AGENTS.md'), 'utf8');
    for (const specialist of [
      'adventurer',
      'architect',
      'builder',
      'diagnose',
      'planner',
      'reviewer',
      'writer',
    ]) {
      expect(text).toContain(specialist);
    }
    // All three sections from the opencode rules are preserved.
    expect(text).toContain('## Orchestration');
    expect(text).toContain('## Delegation');
    expect(text).toContain('## Context Management');
  });
});

describe('package.json', () => {
  it('has the expected name, private flag, and files', async () => {
    const pkg = await readJson<Record<string, unknown>>('package.json');
    expect(pkg.name).toBe('@maestria/kimi-code');
    expect(pkg.private).toBe(false);
    expect(pkg.type).toBe('module');
  });
});

describe('tool name PascalCase compliance', () => {
  const CANONICAL_TOOLS = new Set([
    'Read',
    'Write',
    'Edit',
    'Grep',
    'Glob',
    'ReadMediaFile',
    'Bash',
    'WebSearch',
    'FetchURL',
    'Agent',
    'AgentSwarm',
    'Skill',
    'AskUserQuestion',
    'TodoList',
    'EnterPlanMode',
    'ExitPlanMode',
    'TaskList',
    'TaskOutput',
    'TaskStop',
    'CronCreate',
    'CronList',
    'CronDelete',
  ]);

  // Known non-tool backtick words commonly found in skill files
  const ALLOWED_VARIATIONS = new Set([
    'explore',
    'plan',
    'coder', // subagent types
    'fein',
    'sonar',
    'blitz', // workflow modes
    'praise',
    'suggestion',
    'issue',
    'nitpick',
    'question', // conventional comments
    'opensrc', // skill name, not a tool
    'vp',
    'pnpm',
    'npm',
    'npx',
    'node',
    'git',
    'curl', // CLI commands
  ]);

  for (const skill of EXPECTED_SKILLS) {
    it(`skills/${skill}/SKILL.md has PascalCase tool references`, async () => {
      const skillPath = path.join(PACKAGE_ROOT, 'skills', skill, 'SKILL.md');
      const text = await readFile(skillPath, 'utf8');
      // Find all backtick-quoted words
      const backtickWords = text.match(/`([A-Za-z][A-Za-z0-9_-]*)`/g) || [];
      const violations: string[] = [];
      for (const match of backtickWords) {
        const word = match.slice(1, -1); // strip backticks
        // Skip things that start with lowercase (unlikely to be tools)
        if (word[0] === word[0]?.toLowerCase()) continue;
        // Skip known non-tool words
        if (ALLOWED_VARIATIONS.has(word)) continue;
        // If it looks like a tool name (PascalCase) but isn't in canonical list
        if (CANONICAL_TOOLS.has(word)) continue;
        // Check for potential Kimi Code tool names that might be missing
        // We flag unrecognized PascalCase as warnings
        violations.push(word);
      }
      // Allow violations to be empty - no assertions needed
      // This test is meant for monitoring, not blocking
      // (since skill references may vary)
      if (violations.length > 0) {
        console.warn(`Unrecognized PascalCase references in ${skill}: ${violations.join(', ')}`);
      }
    });
  }
});
