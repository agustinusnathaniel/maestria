import { Effect } from 'effect';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { registerKimiPlugin } from '@/lib/kimi.js';
import { isRecord } from '@/lib/primitives.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map(async (root) => {
      await rm(root, { force: true, recursive: true });
    }),
  );
});

describe('Kimi Code plugin registration', () => {
  it('records the consolidated package as the managed plugin source', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'maestria-kimi-registration-'));
    roots.push(root);
    const previousHome = process.env.KIMI_CODE_HOME;
    process.env.KIMI_CODE_HOME = root;

    try {
      await Effect.runPromise(registerKimiPlugin());

      const installed: unknown = JSON.parse(
        await readFile(path.join(root, 'plugins', 'installed.json'), 'utf-8'),
      );
      if (!isRecord(installed) || !Array.isArray(installed.plugins)) {
        throw new Error('Kimi installed registry has an invalid shape');
      }
      const plugins: unknown[] = installed.plugins.map((plugin: unknown) => plugin);
      const [plugin] = plugins;
      if (!isRecord(plugin)) {
        throw new Error('Kimi plugin registry is missing maestria');
      }
      expect(plugin).toMatchObject({
        enabled: true,
        id: 'maestria',
        originalSource: '@maestria/plugin',
        root: path.join(root, 'plugins', 'managed', 'maestria'),
        source: 'local-path',
      });
      expect(typeof plugin.installedAt).toBe('string');
      expect(typeof plugin.updatedAt).toBe('string');
    } finally {
      if (previousHome === undefined) {
        delete process.env.KIMI_CODE_HOME;
      } else {
        process.env.KIMI_CODE_HOME = previousHome;
      }
    }
  });
});
