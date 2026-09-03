import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { stageAgentPlugin, validateAgentPlugin } from '@/lib/agent-plugin.js';

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..');
const PORTABLE_PACKAGE = path.join(REPO_ROOT, 'packages/agent-plugin');
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
  it("accepts Maestria's generated portable package", async () => {
    const report = await validateAgentPlugin(PORTABLE_PACKAGE);

    expect(report.valid).toBe(true);
    expect(report.name).toBe('maestria');
    // Floor, not exact count: additions pass, accidental removals fail.
    expect(report.skillNames.length).toBeGreaterThanOrEqual(14);
    expect(report.skillNames).toContain('builder');
    expect(report.skillNames).toContain('global-rules');
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

  it('refuses to overwrite an existing destination', async () => {
    const parent = await makeTempDirectory();
    const destination = path.join(parent, 'staged');
    await mkdir(destination, { recursive: true });

    await expect(stageAgentPlugin({ destination, source: PORTABLE_PACKAGE })).rejects.toThrow(
      'Destination already exists',
    );
  });
});
