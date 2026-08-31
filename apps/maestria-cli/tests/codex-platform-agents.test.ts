import { Effect } from 'effect';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vite-plus/test';

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

const { join } = path;

describe('Codex managed native agents', () => {
  it('installs templates, preserves runtime settings, and removes only managed files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'maestria-codex-agent-install-'));
    const sourceRoot = join(root, 'package');
    const codexHome = join(root, 'codex-home');
    const previousHome = process.env.CODEX_HOME;
    process.env.CODEX_HOME = codexHome;

    try {
      await mkdir(join(sourceRoot, 'agents'), { recursive: true });
      await mkdir(join(sourceRoot, 'instructions'), { recursive: true });
      await writeFile(
        join(sourceRoot, 'instructions', 'AGENTS.md'),
        [
          '<!-- maestria:codex-orchestrator:start -->',
          '## Maestria orchestration',
          'Use $maestria:orchestrator and delegate with agent_type.',
          '<!-- maestria:codex-orchestrator:end -->',
          '',
        ].join('\n'),
      );
      await Promise.all(
        AGENTS.map(async (agent) => {
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
        }),
      );
      await mkdir(join(codexHome, 'agents'), { recursive: true });
      await writeFile(join(codexHome, 'AGENTS.md'), '# Existing instructions\n');
      await writeFile(
        join(codexHome, 'agents', 'builder.toml'),
        'name = "builder"\nmodel = "gpt-5.6-luna"\n',
      );

      await Effect.runPromise(installCodexManagedAgents(sourceRoot));
      const installedInstructions = await readFile(join(codexHome, 'AGENTS.md'), 'utf-8');
      expect(installedInstructions).toContain('# Existing instructions');
      expect(installedInstructions).toContain('maestria:codex-orchestrator:start');
      expect(installedInstructions.match(/maestria:codex-orchestrator:start/gu)).toHaveLength(1);
      expect(await readFile(join(codexHome, '.maestria-agents.json'), 'utf-8')).toContain(
        '"instructionsFile": "AGENTS.md"',
      );
      await Effect.runPromise(installCodexManagedAgents(sourceRoot));
      expect(await readFile(join(codexHome, 'AGENTS.md'), 'utf-8')).toBe(installedInstructions);
      const builderPath = join(codexHome, 'agents', 'maestria-builder.toml');
      expect(await readFile(builderPath, 'utf-8')).toContain('model = "gpt-5.6-luna"');
      const builder = await readFile(builderPath, 'utf-8');
      await writeFile(
        builderPath,
        `${builder.replace('gpt-5.6-luna', 'gpt-5.6-terra')}model_reasoning_effort = "high"\nservice_tier = "fast"\n`,
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

      const updated = await readFile(builderPath, 'utf-8');
      expect(updated).toContain('description = "updated builder"');
      expect(updated).toContain('developer_instructions = "updated instructions"');
      expect(updated).toContain('model = "gpt-5.6-terra"');
      expect(updated).toContain('model_reasoning_effort = "high"');
      expect(updated).toContain('service_tier = "fast"');

      await Effect.runPromise(removeCodexManagedAgents());
      const remainingInstructions = await readFile(join(codexHome, 'AGENTS.md'), 'utf-8');
      expect(remainingInstructions).toBe('# Existing instructions\n');
      await expect(readFile(builderPath, 'utf-8')).rejects.toMatchObject({ code: 'ENOENT' });
      await expect(
        readFile(join(codexHome, '.maestria-agents.json'), 'utf-8'),
      ).rejects.toMatchObject({ code: 'ENOENT' });

      await rm(join(codexHome, 'AGENTS.md'));
      await Effect.runPromise(installCodexManagedAgents(sourceRoot));
      expect(await readFile(join(codexHome, '.maestria-agents.json'), 'utf-8')).toContain(
        '"instructionsCreated": true',
      );
      await Effect.runPromise(removeCodexManagedAgents());
      await expect(readFile(join(codexHome, 'AGENTS.md'), 'utf-8')).rejects.toMatchObject({
        code: 'ENOENT',
      });
    } finally {
      if (previousHome === undefined) {
        delete process.env.CODEX_HOME;
      } else {
        process.env.CODEX_HOME = previousHome;
      }
      await rm(root, { force: true, recursive: true });
    }
  });

  it('uses active override instructions and preserves both user files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'maestria-codex-agent-override-'));
    const sourceRoot = join(root, 'package');
    const codexHome = join(root, 'codex-home');
    const previousHome = process.env.CODEX_HOME;
    process.env.CODEX_HOME = codexHome;

    try {
      await mkdir(join(sourceRoot, 'agents'), { recursive: true });
      await mkdir(join(sourceRoot, 'instructions'), { recursive: true });
      await Promise.all(
        AGENTS.map(async (agent) => {
          await writeFile(
            join(sourceRoot, 'agents', `maestria-${agent}.toml`),
            `name = "maestria-${agent}"\ndescription = "${agent}"\ndeveloper_instructions = "${agent}"\n`,
          );
        }),
      );
      await writeFile(
        join(sourceRoot, 'instructions', 'AGENTS.md'),
        '<!-- maestria:codex-orchestrator:start -->\nmanaged\n<!-- maestria:codex-orchestrator:end -->\n',
      );
      await mkdir(codexHome, { recursive: true });
      await writeFile(join(codexHome, 'AGENTS.md'), 'default user instructions\n');
      await writeFile(join(codexHome, 'AGENTS.override.md'), 'override user instructions\n');

      await Effect.runPromise(installCodexManagedAgents(sourceRoot));
      expect(await readFile(join(codexHome, 'AGENTS.override.md'), 'utf-8')).toContain('managed');
      expect(await readFile(join(codexHome, 'AGENTS.md'), 'utf-8')).toBe(
        'default user instructions\n',
      );

      await Effect.runPromise(removeCodexManagedAgents());
      expect(await readFile(join(codexHome, 'AGENTS.override.md'), 'utf-8')).toBe(
        'override user instructions\n',
      );
      expect(await readFile(join(codexHome, 'AGENTS.md'), 'utf-8')).toBe(
        'default user instructions\n',
      );
    } finally {
      if (previousHome === undefined) {
        delete process.env.CODEX_HOME;
      } else {
        process.env.CODEX_HOME = previousHome;
      }
      await rm(root, { force: true, recursive: true });
    }
  });
});
