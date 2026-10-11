import { mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { AGENT_PLUGIN_PACKAGE, stageAgentPlugin } from '@/lib/agent-plugin-staging.js';
import { validateAgentPlugin } from '@/lib/agent-plugin-validation.js';

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..');
const PORTABLE_PACKAGE = path.join(REPO_ROOT, 'packages/agent-plugins');
const PLUGIN_DATA_PLACEHOLDER = ['$', '{PLUGIN_DATA}'].join('');
const tempDirectories: string[] = [];

const makeTempDirectory = async (): Promise<string> => {
  const directory = await mkdtemp(path.join('/tmp', 'maestria-cli-agent-plugin-'));
  tempDirectories.push(directory);
  return directory;
};

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map(async (directory) => {
      await rm(directory, { force: true, recursive: true });
    }),
  );
});

const writeManifest = async (root: string, manifest: Record<string, unknown>): Promise<void> => {
  await writeFile(path.join(root, 'plugin.json'), `${JSON.stringify(manifest)}\n`);
};

describe('Agent Plugin validation', () => {
  it("accepts maestria's generated portable package", async () => {
    const report = await validateAgentPlugin(PORTABLE_PACKAGE);

    expect(report.valid).toBe(true);
    expect(report.name).toBe('maestria');
    expect(report.skillNames).toEqual(['handoff', 'iteration-limits']);
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

  it('rejects unsafe MCP paths and non-HTTPS remote endpoints', async () => {
    const root = await makeTempDirectory();
    await writeManifest(root, {
      $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
      name: 'fixture',
    });
    await writeFile(
      path.join(root, 'mcp.json'),
      `${JSON.stringify({
        $schema: 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json',
        mcpServers: {
          data: {
            command: 'server',
            cwd: `${PLUGIN_DATA_PLACEHOLDER}/..\\\\outside`,
            type: 'stdio',
          },
          local: { command: './bin/server', cwd: './../outside', type: 'stdio' },
          loopback: { type: 'streamable-http', url: 'http://127.0.0.1/mcp' },
          remote: {
            headers: {
              Authorization: 'embedded',
              authorization: 'duplicate',
              'bad header': 'value',
            },
            type: 'streamable-http',
            url: 'http://127.0.0.1.attacker.example/mcp',
          },
        },
      })}\n`,
    );

    const report = await validateAgentPlugin(root);

    expect(report.valid).toBe(false);
    expect(report.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('local'),
        expect.stringContaining('escapes PLUGIN_DATA'),
        expect.stringContaining('remote'),
        expect.stringContaining('duplicate header name'),
        expect.stringContaining('valid HTTP header name'),
        expect.stringContaining('must use HTTPS outside loopback hosts'),
      ]),
    );
    expect(report.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('may contain credentials')]),
    );
  });
});

describe('Agent Plugin staging', () => {
  it('defaults portable staging to the consolidated package', () => {
    expect(AGENT_PLUGIN_PACKAGE).toBe('@maestria/agent-plugins');
  });

  it('copies and revalidates a local package at an explicit destination', async () => {
    const parent = await makeTempDirectory();
    const destination = path.join(parent, 'staged');

    const staged = await stageAgentPlugin({
      destination,
      source: PORTABLE_PACKAGE,
    });

    expect(staged.destination).toBe(destination);
    expect(staged.source).toBe(PORTABLE_PACKAGE);
    expect(staged.valid).toBe(true);
    const manifest: unknown = JSON.parse(
      await readFile(path.join(destination, 'plugin.json'), 'utf-8'),
    ) as unknown;
    expect(manifest).toMatchObject({ name: 'maestria' });
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
        files: [
          'plugin.json',
          '.host-plugin',
          'commands',
          'rules',
          'agents',
          'assets',
          'hooks',
          'mcp.json',
        ],
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
    await writeFile(
      path.join(source, 'mcp.json'),
      JSON.stringify({
        $schema: 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json',
        mcpServers: {},
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
      'mcp.json',
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

  it('refuses to overwrite an existing destination', async () => {
    const parent = await makeTempDirectory();
    const destination = path.join(parent, 'staged');
    await mkdir(destination, { recursive: true });

    await expect(stageAgentPlugin({ destination, source: PORTABLE_PACKAGE })).rejects.toThrow(
      'Destination already exists',
    );
  });
});
