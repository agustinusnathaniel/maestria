import { mkdir, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vite-plus/test';

import { AGENT_PLUGIN_PACKAGE, stageAgentPlugin } from '@/lib/agent-plugin-staging.js';
import { validateAgentPlugin } from '@/lib/agent-plugin-validation.js';

import { PORTABLE_PACKAGE, useTempDirectories } from './agent-plugin-test-support.js';

const makeTempDirectory = useTempDirectories();

const writeManifest = async (root: string, manifest: Record<string, unknown>): Promise<void> => {
  await writeFile(path.join(root, 'plugin.json'), `${JSON.stringify(manifest)}\n`);
};

describe('Agent Plugin validation', () => {
  it("accepts maestria's generated portable package", async () => {
    const report = await validateAgentPlugin(PORTABLE_PACKAGE);

    expect(report.valid).toBe(true);
    expect(report.name).toBe('maestria');
    expect(report.skillNames).toEqual([
      'create-pull-request',
      'diagnose',
      'docs-update',
      'handoff',
      'iteration-limits',
    ]);
    expect(report.errors).toEqual([]);
  });

  it('rejects malformed manifest identity and skill content', async () => {
    const root = await makeTempDirectory();
    await writeManifest(root, {
      $schema: 'https://example.com/plugin.schema.json',
      name: 'Bad--Plugin',
    });
    await writeFile(path.join(root, 'skills.md'), 'not a skill directory\n');

    const report = await validateAgentPlugin(root);

    expect(report.valid).toBe(false);
    expect(report.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('plugin.json "$schema"'),
        expect.stringContaining('plugin.json field "name"'),
      ]),
    );
  });

  it('rejects a package that declares MCP servers, which maestria does not ship', async () => {
    const root = await makeTempDirectory();
    await writeManifest(root, {
      $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
      name: 'fixture',
    });
    await writeFile(path.join(root, 'mcp.json'), '{"mcpServers":{}}\n');

    const report = await validateAgentPlugin(root);

    expect(report.valid).toBe(false);
    expect(report.errors).toEqual([expect.stringContaining('mcp.json is not supported')]);
    expect(report.validationScope).toBe('portable-manifest-skills');
  });
  it('defaults portable staging to the consolidated package', () => {
    expect(AGENT_PLUGIN_PACKAGE).toBe('@maestria/agent-plugins');
  });

  it('fetches, stages, and revalidates an npm package source', async () => {
    const parent = await makeTempDirectory();
    const destination = path.join(parent, 'staged');
    const previousNpmCache = process.env.npm_config_cache;
    process.env.npm_config_cache = path.join(parent, 'npm-cache');

    try {
      const staged = await stageAgentPlugin({
        destination,
        source: `file:${PORTABLE_PACKAGE}`,
      });

      expect(staged.destination).toBe(destination);
      expect(staged.source).toBe(`file:${PORTABLE_PACKAGE}`);
      expect(staged.valid).toBe(true);
    } finally {
      if (previousNpmCache === undefined) {
        delete process.env.npm_config_cache;
      } else {
        process.env.npm_config_cache = previousNpmCache;
      }
    }
  }, 30_000);

  it('stages npm publishable files without running lifecycle scripts', async () => {
    const parent = await makeTempDirectory();
    const source = path.join(parent, 'source');
    const destination = path.join(parent, 'staged');
    await mkdir(source);
    await writeManifest(source, {
      $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
      name: 'fixture',
    });
    await writeFile(
      path.join(source, 'package.json'),
      JSON.stringify({
        files: ['plugin.json', '.host-plugin', 'commands', 'rules', 'agents', 'assets', 'hooks'],
        name: 'fixture',
        scripts: { prepack: 'node -e "process.exit(99)"' },
        version: '1.0.0',
      }),
    );
    await Promise.all(
      [
        '.host-plugin',
        'commands',
        'rules',
        'agents',
        'assets',
        'hooks',
        'generation',
        'tests',
        'node_modules',
      ].map(async (directory) => {
        await mkdir(path.join(source, directory));
        await writeFile(path.join(source, directory, 'resource.txt'), directory);
      }),
    );
    await writeFile(path.join(source, 'README.md'), '# Fixture');

    await stageAgentPlugin({ destination, source });

    const stagedEntries = await readdir(destination);
    expect(stagedEntries.toSorted()).toEqual([
      '.host-plugin',
      'README.md',
      'agents',
      'assets',
      'commands',
      'hooks',
      'package.json',
      'plugin.json',
      'rules',
    ]);
    expect(await readFile(path.join(destination, 'assets', 'resource.txt'), 'utf-8')).toBe(
      'assets',
    );
  }, 30_000);

  it('preserves arbitrary directory-plugin resources and materializes contained symlinks', async () => {
    const parent = await makeTempDirectory();
    const source = path.join(parent, 'source');
    const destination = path.join(parent, 'staged');
    await mkdir(path.join(source, '.custom-host'), { recursive: true });
    await mkdir(path.join(source, 'assets'));
    await writeManifest(source, {
      $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
      name: 'fixture',
    });
    await writeFile(path.join(source, '.custom-host', 'manifest.json'), '{}');
    await writeFile(path.join(source, 'assets', 'original.txt'), 'asset');
    await symlink('original.txt', path.join(source, 'assets', 'linked.txt'));

    await stageAgentPlugin({ destination, source });
    await rm(source, { recursive: true });

    expect(await readFile(path.join(destination, '.custom-host', 'manifest.json'), 'utf-8')).toBe(
      '{}',
    );
    expect(await readFile(path.join(destination, 'assets', 'linked.txt'), 'utf-8')).toBe('asset');
  });

  it('rejects asset symlinks outside the plugin before creating a destination', async () => {
    const parent = await makeTempDirectory();
    const source = path.join(parent, 'source');
    const destination = path.join(parent, 'staged');
    await mkdir(path.join(source, 'assets'), { recursive: true });
    await writeManifest(source, {
      $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
      name: 'fixture',
    });
    await writeFile(path.join(parent, 'private.txt'), 'private');
    await symlink('../../private.txt', path.join(source, 'assets', 'secret.txt'));

    await expect(stageAgentPlugin({ destination, source })).rejects.toThrow(
      'outside the plugin root',
    );
    await expect(readdir(destination)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await readFile(path.join(parent, 'private.txt'), 'utf-8')).toBe('private');
  });

  it('rejects cyclic directory symlinks without leaving a partial destination', async () => {
    const parent = await makeTempDirectory();
    const source = path.join(parent, 'source');
    const destination = path.join(parent, 'staged');
    await mkdir(source);
    await writeManifest(source, {
      $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
      name: 'fixture',
    });
    await symlink('.', path.join(source, 'loop'));

    await expect(stageAgentPlugin({ destination, source })).rejects.toThrow('cyclic');
    await expect(readdir(destination)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects unsafe or malformed files metadata instead of copying the source tree', async () => {
    const parent = await makeTempDirectory();
    const cases = [
      42,
      ['plugin.json', '../outside'],
      ['plugin.json', '/outside'],
      ['plugin.json', 'C:\\outside'],
      ['plugin.json', ''],
    ];
    await Promise.all(
      cases.map(async (files, index) => {
        const source = path.join(parent, `source-${index}`);
        const destination = path.join(parent, `staged-${index}`);
        await mkdir(source);
        await writeManifest(source, {
          $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
          name: 'fixture',
        });
        await writeFile(
          path.join(source, 'package.json'),
          JSON.stringify({ files, name: 'fixture', version: '1.0.0' }),
        );

        await expect(stageAgentPlugin({ destination, source })).rejects.toThrow(
          'package.json files',
        );
        await expect(readdir(destination)).rejects.toMatchObject({ code: 'ENOENT' });
      }),
    );
  });

  it('cleans a new destination when the publishable payload omits its portable manifest', async () => {
    const parent = await makeTempDirectory();
    const source = path.join(parent, 'source');
    const destination = path.join(parent, 'staged');
    await mkdir(source);
    await writeManifest(source, {
      $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
      name: 'fixture',
    });
    await writeFile(
      path.join(source, 'package.json'),
      JSON.stringify({ files: [], name: 'fixture', version: '1.0.0' }),
    );

    await expect(stageAgentPlugin({ destination, source })).rejects.toThrow('plugin.json');
    await expect(readdir(destination)).rejects.toMatchObject({ code: 'ENOENT' });
  }, 30_000);
});
