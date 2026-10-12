import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import type * as nodeOs from 'node:os';
import path from 'node:path';
import { Effect } from 'effect';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { getPlatform } from '@/lib/platforms.js';
import type * as shell from '@/lib/shell.js';
import type { CommandError } from '@/lib/shell.js';

const fixture = vi.hoisted(() => ({
  archive: '',
  home: `/tmp/maestria-cursor-upgrade-${process.pid}-${Math.random().toString(16).slice(2)}`,
  packCalls: 0,
}));

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof nodeOs>();
  return { ...actual, homedir: () => fixture.home };
});

vi.mock('@/lib/shell.js', async (importOriginal) => {
  const actual = await importOriginal<typeof shell>();
  return {
    ...actual,
    invalidateVersionCache: () => Effect.void,
    run: (command: string, args: string[]) =>
      Effect.tryPromise({
        catch: (error) => new actual.CommandError({ command, message: String(error) }),
        try: async () => {
          if (command === 'npm') {
            fixture.packCalls += 1;
            const destination = args[args.indexOf('--pack-destination') + 1];
            await copyFile(fixture.archive, path.join(destination, 'maestria-plugin-0.1.0.tgz'));
          } else if (command === 'tar') {
            execFileSync(command, args);
          }
          return '';
        },
      }),
  };
});

const pluginRoot = path.join(fixture.home, '.cursor/plugins/local/maestria');
const repoRoot = path.resolve(import.meta.dirname, '../../..');
const configuredAgent = (model: string): string =>
  `---\nname: builder\nmodel: ${model}\n---\nLegacy prompt.\n`;
const generatedAgent = '---\nname: builder\n---\nPrevious shared prompt.\n';
const newAgent = '---\nname: builder\n---\nNew canonical prompt.\n';
const installedPath = path.join(pluginRoot, 'agents/builder.md');
const legacyPath = path.join(pluginRoot, 'agents/cursor/builder.md');

const update = (): Effect.Effect<void, CommandError> => {
  const cursor = getPlatform('cursor');
  if (cursor === undefined) {
    throw new Error('Cursor platform is unavailable');
  }
  return cursor.update('0.1.0');
};

const writeLegacyCopy = async (content: string): Promise<void> => {
  await mkdir(path.dirname(legacyPath), { recursive: true });
  await writeFile(legacyPath, content);
};

beforeEach(async () => {
  await rm(fixture.home, { force: true, recursive: true });
  const payload = path.join(fixture.home, 'payload/package');
  await mkdir(path.join(payload, 'agents'), { recursive: true });
  await writeFile(path.join(payload, 'agents/builder.md'), newAgent);
  await mkdir(path.join(pluginRoot, 'agents'), { recursive: true });
  fixture.archive = path.join(fixture.home, 'replacement.tgz');
  execFileSync('tar', ['-czf', fixture.archive, '-C', path.dirname(payload), 'package']);
  fixture.packCalls = 0;
});

afterAll(async () => {
  await rm(fixture.home, { force: true, recursive: true });
});

describe('Cursor consolidated package upgrade', () => {
  it('moves a model configured in the earlier Cursor-only copy onto the shared profile', async () => {
    await writeFile(installedPath, generatedAgent);
    await writeLegacyCopy(configuredAgent('legacy-model'));
    await Effect.runPromise(update());
    const installed = await readFile(installedPath, 'utf-8');
    expect(installed).toContain('model: legacy-model');
    expect(installed).toContain('New canonical prompt.');
    expect(installed).not.toContain('Previous shared prompt.');
    expect(fixture.packCalls).toBe(1);
    await expect(readFile(legacyPath, 'utf-8')).rejects.toMatchObject({ code: 'ENOENT' });
    const evidence = path.join(repoRoot, 'artifacts/cursor-upgrade-evidence.json');
    await mkdir(path.dirname(evidence), { recursive: true });
    await writeFile(
      evidence,
      `${JSON.stringify(
        {
          from: 'agents/cursor/builder.md',
          installed,
          model: 'legacy-model',
          reproduction: 'pnpm --dir apps/maestria-cli exec vp test tests/cursor-upgrade.test.ts',
          result: 'passed',
          to: 'agents/builder.md',
        },
        null,
        2,
      )}\n`,
    );
  });

  it('preserves a model configured on the standalone root profile', async () => {
    await writeFile(installedPath, configuredAgent('standalone-model'));
    await Effect.runPromise(update());
    const installed = await readFile(installedPath, 'utf-8');
    expect(installed).toContain('model: standalone-model');
    expect(installed).toContain('New canonical prompt.');
  });

  it('prefers the shared profile model over a stale Cursor-only copy', async () => {
    await writeFile(installedPath, configuredAgent('current-model'));
    await writeLegacyCopy(configuredAgent('stale-model'));
    await Effect.runPromise(update());
    const installed = await readFile(installedPath, 'utf-8');
    expect(installed).toContain('model: current-model');
    expect(installed).not.toContain('stale-model');
  });

  it('aborts before replacement when the shared profile read fails for a reason other than absence', async () => {
    await mkdir(installedPath);
    await expect(Effect.runPromise(update())).rejects.toThrow(/EISDIR/u);
    expect(fixture.packCalls).toBe(0);
  });

  it('aborts before replacement when the legacy copy read fails for a reason other than absence', async () => {
    await writeFile(installedPath, generatedAgent);
    await mkdir(legacyPath, { recursive: true });
    await expect(Effect.runPromise(update())).rejects.toThrow(/EISDIR/u);
    expect(fixture.packCalls).toBe(0);
    expect(await readFile(installedPath, 'utf-8')).toBe(generatedAgent);
  });
});
