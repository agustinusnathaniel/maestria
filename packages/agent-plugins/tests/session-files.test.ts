import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vite-plus/test';

const root = path.resolve(import.meta.dirname, '..');
const read = async (relative: string): Promise<string> =>
  await readFile(path.join(root, relative), 'utf-8');

const bytes = (text: string): number => Buffer.byteLength(text);

const HOST_NOTES = ['Devin', 'Codex CLI', 'Hermes', 'Kimi Code'] as const;

/** Each host reads one session file and drops or truncates text past its cap. */
const SESSION_FILES = [
  { file: 'AGENTS.md', host: 'Devin', limit: 16 * 1024, measure: bytes, modes: false },
  {
    file: 'codex.agents.md',
    host: 'Codex CLI',
    limit: 32 * 1024,
    measure: bytes,
    modes: true,
  },
  {
    file: 'hermes.context.md',
    host: 'Hermes',
    limit: 20_000,
    measure: (text: string) => text.length,
    modes: false,
  },
  {
    file: 'kimi.system-prompt.md',
    host: 'Kimi Code',
    limit: 32 * 1024,
    measure: bytes,
    modes: true,
  },
] as const;

describe('per-host session files', () => {
  for (const { file, host, limit, measure, modes } of SESSION_FILES) {
    it(`fits ${file} under the ${host} cap with the core and only its own note`, async () => {
      const context = await read(file);
      // Past the cap, Devin and Hermes truncate and Codex and Kimi drop the rest, so the
      // always-on core would silently lose its tail.
      expect(measure(context)).toBeLessThanOrEqual(limit);
      expect(context).toContain('## Universal Floors');
      expect(context).toContain('## Routing');
      expect(context).toContain('## Precedence and Shipping');
      expect(context.includes('## MODE: fein')).toBe(modes);
      for (const other of HOST_NOTES) {
        expect(context.includes(`### ${other} Integration`)).toBe(other === host);
      }
    });
  }

  it('ships the modes to Devin as skills only its manifest selects', async () => {
    const devin: unknown = JSON.parse(await read('.devin-plugin/plugin.json'));
    expect(devin).toMatchObject({ skills: ['./skills/', './devin/skills/'] });
    const modes = ['fein', 'sonar', 'blitz'];
    const skills = await Promise.all(
      modes.map(async (mode) => await read(`devin/skills/${mode}/SKILL.md`)),
    );
    for (const [index, mode] of modes.entries()) {
      expect(skills[index]).toMatch(new RegExp(`^name: ${mode}$`, 'mu'));
      expect(skills[index]).toContain(`## MODE: ${mode}`);
      expect(skills[index]).toContain('$ARGUMENTS');
    }
  });
});
