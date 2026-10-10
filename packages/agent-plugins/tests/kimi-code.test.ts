import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vite-plus/test';

const packageRoot = path.resolve(import.meta.dirname, '..');
const root = path.join(packageRoot, 'plugin');
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const manifest = async (): Promise<Record<string, unknown>> => {
  const value: unknown = JSON.parse(await readFile(path.join(root, 'kimi.plugin.json'), 'utf-8'));
  if (!isRecord(value)) {
    throw new Error('Invalid Kimi manifest');
  }
  return value;
};

describe('Kimi shared methodology loading', () => {
  it('starts the shared orchestrator without discovering other hosts native profiles', async () => {
    const config = await manifest();
    expect(config.skills).toBe('./skills/');
    expect(config.sessionStart).toEqual({ skill: 'orchestrator' });
    expect(config.agents).toEqual([]);
    const orchestrator = await readFile(path.join(root, 'skills/orchestrator/SKILL.md'), 'utf-8');
    expect(orchestrator).toContain('../../integrations/kimi-code/README.md');
    const globalRules = await stat(path.join(root, 'skills/global-rules/SKILL.md'));
    expect(globalRules.isFile()).toBe(true);
  });

  it('injects shared global rules within the host system instruction size limit', async () => {
    const config = await manifest();
    expect(config.systemPromptPath).toBe('./skills/global-rules/SKILL.md');
    const rules = await readFile(path.join(root, String(config.systemPromptPath)), 'utf-8');
    expect(Buffer.byteLength(rules)).toBeLessThanOrEqual(32 * 1024);
    expect(rules).toContain('## Universal Floors');
    expect(config.systemPrompt).toContain('seven specialist personas');
  });

  it('carries the complete methodology into isolated children before dispatch', async () => {
    const config = await manifest();
    expect(config.skillInstructions).toContain('global-rules');
    expect(config.skillInstructions).toContain('full role');
    expect(config.skillInstructions).toContain('before');
    const guide = await readFile(path.join(root, 'integrations/kimi-code/README.md'), 'utf-8');
    expect(guide).toContain('AgentSwarm');
    expect(guide).toContain('builder | `coder`');
    expect(guide).toContain('reviewer | `plan`');
    expect(guide).toContain('adventurer | `explore`');
    expect(guide).toContain('global-rules');
    expect(guide).toContain('full role');
  });

  it('preserves shared read-only methodology independently of the host profile', async () => {
    const reviewer = await readFile(path.join(root, 'skills/reviewer/SKILL.md'), 'utf-8');
    const adventurer = await readFile(path.join(root, 'skills/adventurer/SKILL.md'), 'utf-8');
    expect(reviewer.slice(0, 1500)).toMatch(/never implement|read.only|do not edit/iu);
    expect(adventurer.slice(0, 1500)).toMatch(/read.only/iu);
  });

  it('keeps explicit workflow aliases outside other clients conventional discovery roots', async () => {
    const config = await manifest();
    expect(config.commands).toBe('./integrations/kimi-code/commands/');
    await Promise.all(
      ['fein', 'sonar', 'blitz'].map(async (mode) => {
        const alias = await readFile(
          path.join(root, `integrations/kimi-code/commands/${mode}.md`),
          'utf-8',
        );
        expect(alias).toContain(`[MODE: ${mode}]`);
        expect(alias).toContain(`\`${mode}\``);
        expect(alias).toContain('arguments');
        expect(alias).not.toContain('## MODE:');
      }),
    );
  });
});
