import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vite-plus/test';

import { stageAgentPlugin } from '@/lib/agent-plugin-staging.js';

import { PORTABLE_PACKAGE, useTempDirectories } from './agent-plugin-test-support.js';

const makeTempDirectory = useTempDirectories();

describe('Agent Plugin local staging', () => {
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
