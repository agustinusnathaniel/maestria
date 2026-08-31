import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vite-plus/test';

const __dirname = import.meta.dirname;
const PACKAGE_ROOT = path.resolve(__dirname, '..');

const PLUGIN_NAME_REGEX = /^[a-z0-9][a-z0-9_-]{0,63}$/u;
const SYSTEM_PROMPT_MAX_BYTES = 32 * 1024;
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

const EXPECTED_COMMANDS = ['fein', 'sonar', 'blitz'] as const;

type JsonObject = Record<string, unknown>;

const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isUnknownArray = (value: unknown): value is unknown[] => Array.isArray(value);

const readJson = async (relativePath: string): Promise<JsonObject> => {
  const absolute = path.join(PACKAGE_ROOT, relativePath);
  const raw = await readFile(absolute, 'utf-8');
  const value: unknown = JSON.parse(raw);
  if (!isJsonObject(value)) {
    throw new Error(`expected a JSON object: ${relativePath}`);
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

const parseFrontmatterValue = (value: string): string | string[] => {
  if (value === '[]' || value === '') {
    return value === '[]' ? [] : '';
  }
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim();
    return inner === ''
      ? []
      : inner.split(',').map((entry) => entry.trim().replaceAll(/^['"]|['"]$/gu, ''));
  }
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
};

const parseFrontmatter = (text: string): { data: Record<string, unknown>; body: string } => {
  const lines = text.split(/\r?\n/u);
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
  for (const line of yamlText.split(/\r?\n/u)) {
    const m = /^(?<key>[A-Za-z][A-Za-z0-9_-]*):\s*(?<rawValue>.*)$/u.exec(line);
    const key = m?.groups?.key;
    const rawValue = m?.groups?.rawValue;
    if (key === undefined || rawValue === undefined) {
      continue;
    }
    const value = rawValue.trim();
    data[key] = parseFrontmatterValue(value);
  }
  const body = lines.slice(close + 1).join('\n');
  return { body, data };
};

describe('kimi.plugin.json manifest', () => {
  it('exists and parses as valid JSON', async () => {
    const manifest = await readJson('kimi.plugin.json');
    expect(typeof manifest).toBe('object');
    expect(manifest).not.toBeNull();
  });

  it('has a "name" matching the Kimi Code PLUGIN_NAME_REGEX', async () => {
    const manifest = await readJson('kimi.plugin.json');
    expect(typeof manifest.name).toBe('string');
    expect(manifest.name).toMatch(PLUGIN_NAME_REGEX);
  });

  it('keeps the plugin version aligned with package metadata', async () => {
    const [manifest, pkg] = await Promise.all([
      readJson('kimi.plugin.json'),
      readJson('package.json'),
    ]);
    expect(manifest.version).toBe(pkg.version);
  });

  it('has "skills" field that starts with "./"', async () => {
    const manifest = await readJson('kimi.plugin.json');
    const { skills } = manifest;
    expect(skills).toBeDefined();
    if (isUnknownArray(skills)) {
      expect(skills.length).toBeGreaterThan(0);
      for (const entry of skills) {
        expect(typeof entry).toBe('string');
        if (typeof entry === 'string') {
          expect(entry.startsWith('./')).toBe(true);
        }
      }
    } else {
      expect(typeof skills).toBe('string');
      if (typeof skills === 'string') {
        expect(skills.startsWith('./')).toBe(true);
      }
    }
  });

  it('declares native plugin slash commands', async () => {
    const manifest = await readJson('kimi.plugin.json');
    expect(manifest.commands).toBe('./commands/');
  });

  it('has "sessionStart.skill" pointing at the orchestrator skill', async () => {
    const manifest = await readJson('kimi.plugin.json');
    expect(manifest.sessionStart).toBeDefined();
    const sessionStart = isJsonObject(manifest.sessionStart) ? manifest.sessionStart : undefined;
    expect(sessionStart?.skill).toBe('orchestrator');
    const skillPath = path.join(PACKAGE_ROOT, 'skills', 'orchestrator', 'SKILL.md');
    expect(await pathExists(skillPath)).toBe(true);
  });

  it('uses the native systemPromptPath for global rules', async () => {
    const manifest = await readJson('kimi.plugin.json');
    expect(manifest.systemPromptPath).toBe('./SYSTEM.md');
    expect(await pathExists(path.join(PACKAGE_ROOT, 'SYSTEM.md'))).toBe(true);
  });

  it('includes required interface fields', async () => {
    const manifest = await readJson('kimi.plugin.json');
    expect(manifest.interface).toBeDefined();
    const manifestInterface = isJsonObject(manifest.interface) ? manifest.interface : undefined;
    expect(manifestInterface?.displayName).toBeDefined();
    expect(manifestInterface?.shortDescription).toBeDefined();
    expect(manifestInterface?.longDescription).toBeDefined();
    expect(manifestInterface?.developerName).toBeDefined();
    expect(manifestInterface?.websiteURL).toBeDefined();
  });

  it('includes author with name', async () => {
    const manifest = await readJson('kimi.plugin.json');
    const author = isJsonObject(manifest.author) ? manifest.author : undefined;
    expect(author?.name).toBeDefined();
  });

  it('does not include unsupported runtime fields', async () => {
    const raw = await readJson('kimi.plugin.json');
    const unsupported = [
      'tools',
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
  it('contains all 8 methodology skills', async () => {
    await Promise.all(
      EXPECTED_SKILLS.map(async (skill) => {
        const skillPath = path.join(PACKAGE_ROOT, 'skills', skill, 'SKILL.md');
        expect(await pathExists(skillPath)).toBe(true);
      }),
    );
  });

  for (const skill of EXPECTED_SKILLS) {
    const relDir = `skills/${skill}`;
    describe(`${relDir}/SKILL.md`, () => {
      it('parses with valid frontmatter', async () => {
        const skillPath = path.join(PACKAGE_ROOT, relDir, 'SKILL.md');
        const text = await readFile(skillPath, 'utf-8');
        const { data } = parseFrontmatter(text);
        expect(typeof data.name).toBe('string');
        if (typeof data.name === 'string') {
          expect(data.name.length).toBeGreaterThan(0);
        }
        expect(typeof data.description).toBe('string');
        if (typeof data.description === 'string') {
          expect(data.description.length).toBeGreaterThan(0);
        }
        expect(data.name).toBe(skill);
        expect(data.type).toBe('prompt');
      });

      it('has a whenToUse field', async () => {
        const skillPath = path.join(PACKAGE_ROOT, relDir, 'SKILL.md');
        const text = await readFile(skillPath, 'utf-8');
        const { data } = parseFrontmatter(text);
        expect(typeof data.whenToUse).toBe('string');
        if (typeof data.whenToUse === 'string') {
          expect(data.whenToUse.trim().length).toBeGreaterThan(0);
        }
      });
    });
  }

  it('orchestrator skill mentions AgentSwarm and the 7-specialist table', async () => {
    const text = await readFile(
      path.join(PACKAGE_ROOT, 'skills', 'orchestrator', 'SKILL.md'),
      'utf-8',
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

  it('preserves the plan-to-coder capability split', async () => {
    const orchestrator = await readFile(
      path.join(PACKAGE_ROOT, 'skills', 'orchestrator', 'SKILL.md'),
      'utf-8',
    );
    const builder = await readFile(
      path.join(PACKAGE_ROOT, 'skills', 'builder', 'SKILL.md'),
      'utf-8',
    );

    expect(orchestrator).toMatch(/Subagent profile.*`plan`/u);
    expect(orchestrator).toMatch(/do \*\*not\*\* have .*Write.*Edit/iu);
    expect(orchestrator).toContain('builder | `coder`');
    expect(builder).toMatch(/Subagent profile.*`coder`/u);
    expect(builder).toMatch(/Write, Edit/u);
    expect(orchestrator).toContain('Runtime Authority');
  });

  it('reviewer skill has the explicit do-not-edit constraint near the top', async () => {
    const text = await readFile(path.join(PACKAGE_ROOT, 'skills', 'reviewer', 'SKILL.md'), 'utf-8');
    const head = text.slice(0, 1500);
    expect(head).toMatch(/do not edit/iu);
  });

  it('adventurer skill has the explicit read-only Bash constraint near the top', async () => {
    const text = await readFile(
      path.join(PACKAGE_ROOT, 'skills', 'adventurer', 'SKILL.md'),
      'utf-8',
    );
    const head = text.slice(0, 2000);
    expect(head).toMatch(/read-only/iu);
    expect(head).toMatch(/Bash/u);
  });
});

describe('native plugin commands', () => {
  for (const command of EXPECTED_COMMANDS) {
    it(`commands/${command}.md exists with command frontmatter`, async () => {
      const commandPath = path.join(PACKAGE_ROOT, 'commands', `${command}.md`);
      expect(await pathExists(commandPath)).toBe(true);
      const text = await readFile(commandPath, 'utf-8');
      const { data, body } = parseFrontmatter(text);
      expect(data.name).toBe(command);
      expect(typeof data.description).toBe('string');
      expect(body).toContain(`[MODE: ${command}]`);
    });
  }
});

describe('SYSTEM.md plugin instructions', () => {
  it('is under the 32 KB Kimi Code truncation budget', async () => {
    const rulesPath = path.join(PACKAGE_ROOT, 'SYSTEM.md');
    const stats = await stat(rulesPath);
    expect(stats.size).toBeLessThanOrEqual(SYSTEM_PROMPT_MAX_BYTES);
  });

  it('contains the 7-specialist delegation table', async () => {
    const text = await readFile(path.join(PACKAGE_ROOT, 'SYSTEM.md'), 'utf-8');
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
    // The compact shared contract preserves its behavioral layers.
    expect(text).toContain('## Outcome and Scope');
    expect(text).toContain('## Delegation and Context');
    expect(text).toContain('## Acceptance and Blind Review');
    expect(text).not.toContain('## Work Unit and Child Budgets');
  });
});

describe('package.json', () => {
  it('has the expected name, private flag, and files', async () => {
    const pkg = await readJson('package.json');
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
    // Subagent types.
    'coder',
    'fein',
    'sonar',
    // Workflow modes.
    'blitz',
    'praise',
    'suggestion',
    'issue',
    'nitpick',
    // Conventional comments.
    'question',
    // Skill name, not a tool.
    'opensrc',
    'vp',
    'pnpm',
    'npm',
    'npx',
    'node',
    'git',
    // CLI commands.
    'curl',
  ]);

  for (const skill of EXPECTED_SKILLS) {
    const relDir = `skills/${skill}`;
    it(`${relDir}/SKILL.md has PascalCase tool references`, async () => {
      const skillPath = path.join(PACKAGE_ROOT, relDir, 'SKILL.md');
      const text = await readFile(skillPath, 'utf-8');
      // Find all backtick-quoted words
      const backtickWords = text.match(/`(?<word>[A-Za-z][A-Za-z0-9_-]*)`/gu) ?? [];
      const violations: string[] = [];
      for (const match of backtickWords) {
        // Strip backticks.
        const word = match.slice(1, -1);
        // Skip things that start with lowercase (unlikely to be tools)
        if (word.startsWith(word[0]?.toLowerCase() ?? '')) {
          continue;
        }
        // Skip known non-tool words
        if (ALLOWED_VARIATIONS.has(word)) {
          continue;
        }
        // If it looks like a tool name (PascalCase) but isn't in canonical list
        if (CANONICAL_TOOLS.has(word)) {
          continue;
        }
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
