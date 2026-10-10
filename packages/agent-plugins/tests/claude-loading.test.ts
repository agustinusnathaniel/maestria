import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vite-plus/test';
import { parse } from 'yaml';

const packageRoot = path.resolve(import.meta.dirname, '..');
const pluginRoot = path.join(packageRoot, 'plugin');
const manifestPath = path.join(pluginRoot, '.claude-plugin/plugin.json');
const roles = [
  'adventurer',
  'architect',
  'builder',
  'diagnose',
  'planner',
  'reviewer',
  'writer',
] as const;
const modes = ['fein', 'sonar', 'blitz'] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseFrontmatter = (
  text: string,
  label: string,
): { body: string; metadata: Record<string, unknown> } => {
  const match = /^---\r?\n(?<frontmatter>[\s\S]*?)\r?\n---\r?\n(?<body>[\s\S]*)$/u.exec(text);
  const frontmatter = match?.groups?.frontmatter;
  if (frontmatter === undefined) {
    throw new Error(`Missing frontmatter in ${label}`);
  }
  const metadata: unknown = parse(frontmatter);
  if (!isRecord(metadata)) {
    throw new Error(`Invalid frontmatter in ${label}`);
  }
  return { body: match?.groups?.body ?? '', metadata };
};

const readManifest = (): Record<string, unknown> => {
  const manifest: unknown = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  if (!isRecord(manifest)) {
    throw new Error('Invalid Claude plugin manifest');
  }
  return manifest;
};

describe('Claude Code native plugin loading', () => {
  it('preloads the shared rules and each role skill while retaining native metadata', () => {
    const manifest = readManifest();
    const agentPaths = manifest.agents;

    expect(agentPaths).toEqual(roles.map((role) => `./agents/claude-code/${role}.md`));

    for (const role of roles) {
      const agentPath = path.join(pluginRoot, `agents/claude-code/${role}.md`);
      const { body, metadata } = parseFrontmatter(fs.readFileSync(agentPath, 'utf-8'), agentPath);
      const expectedDisallowedTools = ['adventurer', 'planner', 'reviewer'].includes(role)
        ? 'Write, Edit'
        : undefined;

      expect(metadata.name).toBe(role);
      expect(metadata.model).toBe('inherit');
      expect(metadata.disallowedTools).toBe(expectedDisallowedTools);
      expect(metadata.skills).toEqual(['maestria:global-rules', `maestria:${role}`]);
      expect(body.length).toBeLessThan(700);
      expect(body).toMatch(/preloaded[\s\S]*role skill/iu);
      expect(body).toMatch(/if either[\s\S]*missing[\s\S]*stop/iu);

      for (const skill of [`global-rules`, role]) {
        const skillPath = path.join(pluginRoot, `skills/${skill}/SKILL.md`);
        expect(fs.existsSync(skillPath)).toBe(true);
        const { metadata: skillMetadata } = parseFrontmatter(
          fs.readFileSync(skillPath, 'utf-8'),
          skillPath,
        );
        expect(skillMetadata.name).toBe(skill);
      }
    }
  });

  it('exposes each workflow mode once through shared skills', () => {
    const manifest = readManifest();

    const pluginName = typeof manifest.name === 'string' ? manifest.name : '';
    expect(pluginName).toBe('maestria');
    expect(manifest.commands).toEqual([]);

    for (const mode of modes) {
      const skillPath = path.join(pluginRoot, `skills/${mode}/SKILL.md`);
      const { metadata } = parseFrontmatter(fs.readFileSync(skillPath, 'utf-8'), skillPath);

      const skillName = typeof metadata.name === 'string' ? metadata.name : '';
      expect(skillName).toBe(mode);
      expect(metadata['user-invocable']).not.toBe(false);
      expect(`/${pluginName}:${skillName}`).toBe(`/maestria:${mode}`);
      expect(
        fs.existsSync(path.join(pluginRoot, `integrations/claude-code/commands/${mode}.md`)),
      ).toBe(false);
    }
  });
});
