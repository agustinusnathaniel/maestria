import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vite-plus/test';
import { parse } from 'yaml';

const packageRoot = path.resolve(import.meta.dirname, '..');
const pluginRoot = packageRoot;
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
  it('embeds complete role and policy context while retaining native metadata', () => {
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
      expect(metadata.skills).toBeUndefined();
      const core = path.resolve(packageRoot, '../core/agent-directives');
      expect(body).toContain(
        fs.readFileSync(path.join(core, `specialists/${role}.md`), 'utf-8').trim(),
      );
      expect(body).toContain(fs.readFileSync(path.join(core, 'rules.md'), 'utf-8').trim());
      expect(body).not.toMatch(/(?:global-rules|reviewer)\/SKILL\.md/u);
    }
  });

  it('exposes each workflow mode once through explicit native commands', () => {
    const manifest = readManifest();

    const pluginName = typeof manifest.name === 'string' ? manifest.name : '';
    expect(pluginName).toBe('maestria');
    expect(manifest.commands).toEqual(modes.map((mode) => `./commands/${mode}.md`));
    for (const mode of modes) {
      const command = fs.readFileSync(path.join(pluginRoot, `commands/${mode}.md`), 'utf-8');
      expect(command).toContain(`[MODE: ${mode}]`);
      expect(command).toContain('$ARGUMENTS');
      expect(command).toContain('## Routing');
      expect(command).toContain('## Universal Floors');
      expect(fs.existsSync(path.join(pluginRoot, `skills/${mode}/SKILL.md`))).toBe(false);
    }
  });
});
