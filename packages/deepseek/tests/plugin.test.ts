import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import type { SkillProvider, SkillProviderControl } from '@deepseek-ai/dsh-skill';
import type { AssembleContext, PromptSection } from '@deepseek-ai/dsh-system-prompt';
import { describe, expect, it } from 'vite-plus/test';

import {
  apply,
  HOST_CONTEXT_COMPATIBLE,
  MAESTRIA_SPECIALISTS,
  inject as maestriaInject,
  name as maestriaName,
  resolveMaestriaPluginConfig,
} from '../src/index.js';
import { createMaestriaSkillProvider, MAESTRIA_SKILL_RANK, parseSkillFile } from '../src/skills.js';

const PACKAGE_ROOT = path.resolve(import.meta.dirname, '..');
const SKILLS_DIR = path.join(PACKAGE_ROOT, 'skills');
const PRESET_DIR = path.join(PACKAGE_ROOT, 'preset', 'maestria');

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

const WORKFLOW_MODES = ['blitz', 'fein', 'sonar'] as const;
const SUPPORTING_SKILLS = ['handoff', 'iteration-limits'] as const;
const ALL_PERSONA_ROLES = ['orchestrator', ...MAESTRIA_SPECIALISTS] as const;

const readSkillText = async (skill: string): Promise<string> =>
  await readFile(path.join(SKILLS_DIR, skill, 'SKILL.md'), 'utf-8');

const parseFrontmatter = (text: string): Record<string, string> => {
  const lines = text.split(/\r?\n/u);
  expect(lines[0]?.trim()).toBe('---');
  const close = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  expect(close).toBeGreaterThan(0);
  const data: Record<string, string> = {};
  for (const line of lines.slice(1, close)) {
    const match = /^(?<key>[A-Za-z][A-Za-z0-9_-]*):\s*(?<value>.*)$/u.exec(line);
    const key = match?.groups?.key;
    const value = match?.groups?.value;
    if (key !== undefined && value !== undefined) {
      data[key] = value.trim();
    }
  }
  return data;
};

interface FakeSection {
  readonly name: string;
  readonly order: number;
  readonly text: string;
}

const EMPTY_ASSEMBLE_CONTEXT: AssembleContext = {};

const createFakeCtx = () => {
  const sections: FakeSection[] = [];
  const variables: { name: string; provider: () => string | undefined }[] = [];
  const providers: SkillProvider[] = [];
  const ctx = {
    skills: {
      registerProvider: (create: (control: SkillProviderControl) => SkillProvider) => {
        providers.push(
          create({
            invalidate: () => {},
            signal: new AbortController().signal,
          }),
        );
        return () => {};
      },
    },
    systemPrompt: {
      section: (section: PromptSection) => {
        sections.push({
          name: section.name,
          order: section.order,
          text: typeof section.text === 'string' ? section.text : '',
        });
        return () => {};
      },
      variable: (name: string, provider: (context: AssembleContext) => string | undefined) => {
        variables.push({ name, provider: () => provider(EMPTY_ASSEMBLE_CONTEXT) });
        return () => {};
      },
    },
  };
  return { ctx, providers, sections, variables };
};

describe('generated DeepSeek Harness skills', () => {
  it('contains exactly the standard skill directories', async () => {
    const entries = await readdir(SKILLS_DIR, { withFileTypes: true });
    const names = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .toSorted();
    expect(names).toEqual([...EXPECTED_SKILLS].toSorted());
  });

  for (const skill of EXPECTED_SKILLS) {
    it(`${skill} has Agent-Skills frontmatter and generated provenance`, async () => {
      const text = await readSkillText(skill);
      const frontmatter = parseFrontmatter(text);
      expect(frontmatter.name).toBe(skill);
      expect(frontmatter.description).not.toBe('');
      expect(text).toContain('Auto-generated from @maestria/core');
      expect(text).not.toMatch(
        /@(?:adventurer|architect|builder|diagnose|orchestrator|planner|reviewer|writer)\b/u,
      );
    });

    it(`${skill} body is safe for strict prompt interpolation`, async () => {
      // DSH renderPrompt throws on any `{{...}}` group that does not resolve
      // against a registered variable, and these bodies feed both prompt
      // sections and persona templates.
      const parsed = parseSkillFile(await readSkillText(skill), `${skill}/SKILL.md`);
      expect(parsed.content).not.toContain('{{');
      expect(parsed.name).toBe(skill);
      expect(parsed.content.length).toBeGreaterThan(0);
    });
  }

  it('keeps native runtime names out of the skill projection', async () => {
    const texts = await Promise.all(EXPECTED_SKILLS.map(readSkillText));
    expect(texts.join('\n')).not.toMatch(
      /\b(?:OpenCode|Claude Code|Codex CLI|Cursor|Hermes|Kimi Code|Prime Agent|Oh My Pi)\b/u,
    );
  });

  it('covers the canonical role set plus workflow modes and supporting skills', () => {
    const expected = new Set<string>([
      ...MAESTRIA_SPECIALISTS,
      ...WORKFLOW_MODES,
      ...SUPPORTING_SKILLS,
      'orchestrator',
      'global-rules',
    ]);
    expect(expected.size).toBe(EXPECTED_SKILLS.length);
  });
});

describe('maestria cordis plugin', () => {
  it('stays assignable to the real augmented host context', () => {
    expect(HOST_CONTEXT_COMPATIBLE).toBe(true);
  });

  it('exports the function-plugin surface', () => {
    expect(maestriaName).toBe('maestria');
    expect([...maestriaInject]).toEqual(['systemPrompt', 'skills']);
    expect(typeof apply).toBe('function');
  });

  it('registers the routing section, persona variables, and the skills provider by default', () => {
    const fake = createFakeCtx();
    apply(fake.ctx, { skillsDir: SKILLS_DIR });

    expect(fake.sections.map((section) => section.name)).toEqual(['maestria:routing']);
    expect(fake.sections[0]?.order).toBe(160);
    expect(fake.variables.map((variable) => variable.name).toSorted()).toEqual(
      [...ALL_PERSONA_ROLES].map((role) => `maestria_${role}`).toSorted(),
    );
    expect(fake.providers).toHaveLength(1);
  });

  it('injects global rules only when configured', () => {
    const fake = createFakeCtx();
    apply(fake.ctx, { injectGlobalRules: true, skillsDir: SKILLS_DIR });

    expect(fake.sections.map((section) => section.name)).toEqual([
      'maestria:routing',
      'maestria:global-rules',
    ]);
    const [, rulesSection] = fake.sections;
    expect(rulesSection?.order).toBe(150);
    expect(rulesSection?.text).toContain('# Global Agent Rules');
    expect(rulesSection?.text.startsWith('<!--')).toBe(false);
  });

  it('rejects malformed composition config loudly at the boundary', () => {
    expect(() => resolveMaestriaPluginConfig({ injectGlobalRules: 'yes' }, SKILLS_DIR)).toThrow(
      /injectGlobalRules/u,
    );
    expect(() => resolveMaestriaPluginConfig({ skillsDir: 42 }, SKILLS_DIR)).toThrow(/skillsDir/u);
    expect(() => resolveMaestriaPluginConfig('full', SKILLS_DIR)).toThrow(/must be an object/u);
  });

  it('resolves the package skills directory by default', () => {
    const resolved = resolveMaestriaPluginConfig(undefined, '/pkg/skills');
    expect(resolved).toEqual({
      injectGlobalRules: false,
      injectRoutingSection: true,
      skillsDir: '/pkg/skills',
    });
  });

  it('persona variable providers return the generated skill bodies', () => {
    const fake = createFakeCtx();
    apply(fake.ctx, { skillsDir: SKILLS_DIR });

    for (const role of ALL_PERSONA_ROLES) {
      const variable = fake.variables.find((entry) => entry.name === `maestria_${role}`);
      expect(variable).toBeDefined();
      const body = variable?.provider();
      expect(body).toBeTruthy();
      expect(body?.startsWith('---')).toBe(false);
    }
  });
});

describe('maestria skills provider', () => {
  const makeProvider = () =>
    createMaestriaSkillProvider(
      SKILLS_DIR,
      'maestria',
    )({
      invalidate: () => {},
      signal: new AbortController().signal,
    });

  it('lists every generated skill as a runtime candidate below user-editable roots', async () => {
    const provider = makeProvider();
    expect(provider.name).toBe('maestria');
    expect(MAESTRIA_SKILL_RANK).toBeGreaterThan(500);

    const candidates = await provider.list({});
    expect(candidates.map((candidate) => candidate.name).toSorted()).toEqual(
      [...EXPECTED_SKILLS].toSorted(),
    );
    for (const candidate of candidates) {
      expect(candidate.rank).toBe(MAESTRIA_SKILL_RANK);
      expect(candidate.source).toBe('runtime');
      expect(candidate.invocation).toEqual({ modelInvocable: true, userInvocable: true });
    }
  });

  it('loads a complete definition with body and directory resource base', async () => {
    const provider = makeProvider();
    const candidates = await provider.list({});
    const orchestrator = candidates.find((candidate) => candidate.name === 'orchestrator');
    if (orchestrator === undefined) {
      throw new Error('orchestrator candidate missing from provider listing');
    }

    const definition = await provider.get(orchestrator, {});
    expect(definition?.provider).toBe('maestria');
    expect(definition?.source).toBe('runtime');
    expect(definition?.resourceBase).toEqual({
      kind: 'directory',
      path: path.join(SKILLS_DIR, 'orchestrator'),
    });
    const skillText = await readSkillText('orchestrator');
    expect(definition?.content).toBe(parseSkillFile(skillText, 'orchestrator/SKILL.md').content);
    expect(definition?.content).toContain('DeepSeek Harness Integration');
  });

  it('returns undefined for unknown locators instead of throwing', async () => {
    const provider = makeProvider();
    const definition = await provider.get(
      {
        description: '',
        invocation: { modelInvocable: true, userInvocable: true },
        locator: '/definitely/missing',
        name: 'nope',
        provider: 'maestria',
        rank: MAESTRIA_SKILL_RANK,
        source: 'runtime',
      },
      {},
    );
    expect(definition).toBeUndefined();
  });
});

const countOccurrences = (haystack: string, needle: string): number =>
  haystack.split(needle).length - 1;

describe('maestria agent preset', () => {
  it('ships preset metadata and derived composition', async () => {
    const preset = await readFile(path.join(PRESET_DIR, 'preset.yml'), 'utf-8');
    expect(preset).toContain('name: Maestria');
    const composition = await readFile(path.join(PRESET_DIR, 'agent.cordis.yml'), 'utf-8');
    expect(composition).toContain('deepseek-ai/deepseek-harness (BSD-3-Clause');
    expect(composition).toContain('@maestria/deepseek');
  });

  it('mounts the methodology plugin and orchestrator persona', async () => {
    const composition = await readFile(path.join(PRESET_DIR, 'agent.cordis.yml'), 'utf-8');
    expect(composition).toContain("name: './plugin/index.js'");
    expect(composition).toContain('injectGlobalRules: true');
    expect(composition).toContain("text: '{{maestria_orchestrator}}'");
  });

  it('exposes one delegation tool per specialist persona', async () => {
    const composition = await readFile(path.join(PRESET_DIR, 'agent.cordis.yml'), 'utf-8');
    for (const role of MAESTRIA_SPECIALISTS) {
      expect(composition).toContain(`toolName: maestria_${role}`);
      expect(composition).toContain(`persona: '{{maestria_${role}}}'`);
    }
    const genericToolNames = [
      'subagent',
      'subagent_fork',
      'subagent_codex',
      'subagent_claude_code',
    ];
    for (const toolName of genericToolNames) {
      expect(composition).toContain(`toolName: ${toolName}`);
    }
    expect(countOccurrences(composition, 'toolName: maestria_')).toBe(MAESTRIA_SPECIALISTS.length);
    expect(countOccurrences(composition, 'toolName: ')).toBe(
      genericToolNames.length + MAESTRIA_SPECIALISTS.length,
    );
    expect(countOccurrences(composition, "name: '@deepseek-ai/dsh-tool-subagent'")).toBe(
      genericToolNames.length + MAESTRIA_SPECIALISTS.length,
    );
  });

  it('keeps persona templates resolvable: preset references match registered variables', async () => {
    const composition = await readFile(path.join(PRESET_DIR, 'agent.cordis.yml'), 'utf-8');
    const referenced = [...composition.matchAll(/\{\{(?<reference>maestria_[a-z_]+)\}\}/gu)].map(
      (match) => match.groups?.reference ?? '',
    );
    const registered = [...ALL_PERSONA_ROLES].map((role) => `maestria_${role}`);
    for (const reference of new Set(referenced)) {
      expect(registered).toContain(reference);
    }
  });
});
