import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vite-plus/test';
import { parse } from 'yaml';

const root = path.resolve(import.meta.dirname, '..');
const roles = ['adventurer', 'architect', 'builder', 'diagnose', 'planner', 'reviewer', 'writer'];
const readOnlyRoles = ['adventurer', 'planner', 'reviewer'];
const modes = ['fein', 'sonar', 'blitz'];

type Manifest = Record<string, unknown>;
const isRecord = (value: unknown): value is Manifest =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const manifest = async (): Promise<Manifest> => {
  const value: unknown = JSON.parse(await readFile(path.join(root, 'kimi.plugin.json'), 'utf-8'));
  if (!isRecord(value)) {
    throw new Error('Expected Kimi manifest object');
  }
  return value;
};

const profileMetadata = (profile: string): Manifest => {
  const frontmatter = /^---\n(?<metadata>[\s\S]*?)\n---/u.exec(profile)?.groups?.metadata ?? '';
  const value: unknown = parse(frontmatter);
  if (!isRecord(value)) {
    throw new Error('Expected profile frontmatter object');
  }
  return value;
};

describe('Kimi native methodology loading', () => {
  it('selects only complete Kimi native profiles', async () => {
    const config = await manifest();
    expect(config.agents).toBe('./agents/kimi-code/');
    expect(config.sessionStart).toBeUndefined();
    expect(config.skillInstructions).toBeUndefined();
    const profiles = await Promise.all(
      roles.map(async (role) => ({
        canonical: await readFile(
          path.join(root, `../core/agent-directives/specialists/${role}.md`),
          'utf-8',
        ),
        profile: await readFile(path.join(root, `agents/kimi-code/${role}.md`), 'utf-8'),
        role,
      })),
    );
    for (const { canonical, profile, role } of profiles) {
      expect(profile).toContain('## Universal Floors');
      expect(profile).toContain(canonical);
      expect(profile).not.toContain('SKILL.md');
      const metadata = profileMetadata(profile);
      expect(metadata.name).toBe(role);
      expect(metadata.model).toBeUndefined();
    }
  });

  it('injects complete policy and router within the host system instruction limit', async () => {
    const config = await manifest();
    expect(config.systemPromptPath).toBe('./rules/kimi-code/bootstrap.md');
    const systemPromptPath = String(config.systemPromptPath);
    const context = await readFile(path.join(root, systemPromptPath), 'utf-8');
    expect(Buffer.byteLength(context)).toBeLessThanOrEqual(32 * 1024);
    expect(context).toContain('## Universal Floors');
    expect(context).toContain('## Routing');
    expect(context).toContain('## MODE: fein');
    const bootstrap = await stat(path.join(root, systemPromptPath));
    expect(bootstrap.isFile()).toBe(true);
  });

  it('preserves native read-only metadata for research and review', async () => {
    const profiles = await Promise.all(
      readOnlyRoles.map(
        async (role) => await readFile(path.join(root, `agents/kimi-code/${role}.md`), 'utf-8'),
      ),
    );
    for (const profile of profiles) {
      expect(profile).toContain('disallowedTools:');
      expect(profile).toContain('WriteFile');
      expect(profile).toContain('StrReplaceFile');
    }
  });

  it('carries complete context and arguments in each native mode command', async () => {
    const config = await manifest();
    expect(config.commands).toBe('./commands/kimi-code/');
    const commands = await Promise.all(
      modes.map(async (mode) => ({
        command: await readFile(path.join(root, `commands/kimi-code/${mode}.md`), 'utf-8'),
        mode,
      })),
    );
    for (const { command, mode } of commands) {
      expect(command).toContain(`[MODE: ${mode}]`);
      expect(command).toContain('arguments');
      expect(command).toContain('## Routing');
      expect(command).toContain('## Universal Floors');
    }
  });
});
