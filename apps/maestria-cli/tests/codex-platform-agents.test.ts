import { describe, expect, it } from 'vite-plus/test';
import { Effect } from 'effect';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installCodexManagedAgents, removeCodexManagedAgents } from '@/lib/platforms.js';

const AGENTS = [
  'adventurer',
  'architect',
  'builder',
  'diagnose',
  'planner',
  'reviewer',
  'writer',
] as const;

describe('Codex managed native agents', () => {
  it('installs templates, preserves runtime settings, and removes only managed files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'maestria-codex-agent-install-'));
    const sourceRoot = join(root, 'package');
    const codexHome = join(root, 'codex-home');
    const previousHome = process.env.CODEX_HOME;
    process.env.CODEX_HOME = codexHome;

    try {
      await mkdir(join(sourceRoot, 'agents'), { recursive: true });
      for (const agent of AGENTS) {
        await writeFile(
          join(sourceRoot, 'agents', `maestria-${agent}.toml`),
          [
            `name = "maestria-${agent}"`,
            `description = "new ${agent}"`,
            `developer_instructions = "new instructions for ${agent}"`,
            ...(agent === 'reviewer' ? ['sandbox_mode = "read-only"'] : []),
            '',
          ].join('\n'),
        );
      }
      await mkdir(join(codexHome, 'agents'), { recursive: true });
      await writeFile(
        join(codexHome, 'agents', 'builder.toml'),
        'name = "builder"\nmodel = "gpt-5.6-luna"\n',
      );

      await Effect.runPromise(installCodexManagedAgents(sourceRoot));
      const builderPath = join(codexHome, 'agents', 'maestria-builder.toml');
      expect(await readFile(builderPath, 'utf8')).toContain('model = "gpt-5.6-luna"');
      await writeFile(
        builderPath,
        `${(await readFile(builderPath, 'utf8')).replace('gpt-5.6-luna', 'gpt-5.6-terra')}model_reasoning_effort = "high"\nservice_tier = "fast"\n`,
      );

      await writeFile(
        join(sourceRoot, 'agents', 'maestria-builder.toml'),
        [
          'name = "maestria-builder"',
          'description = "updated builder"',
          'developer_instructions = "updated instructions"',
          '',
        ].join('\n'),
      );
      await Effect.runPromise(installCodexManagedAgents(sourceRoot));

      const updated = await readFile(builderPath, 'utf8');
      expect(updated).toContain('description = "updated builder"');
      expect(updated).toContain('developer_instructions = "updated instructions"');
      expect(updated).toContain('model = "gpt-5.6-terra"');
      expect(updated).toContain('model_reasoning_effort = "high"');
      expect(updated).toContain('service_tier = "fast"');

      await Effect.runPromise(removeCodexManagedAgents());
      await expect(readFile(builderPath, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
      await expect(
        readFile(join(codexHome, '.maestria-agents.json'), 'utf8'),
      ).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      if (previousHome === undefined) delete process.env.CODEX_HOME;
      else process.env.CODEX_HOME = previousHome;
      await rm(root, { recursive: true, force: true });
    }
  });
});
