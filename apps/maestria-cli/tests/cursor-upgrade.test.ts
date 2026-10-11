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
const originalAgent = '---\nname: builder\nmodel: legacy-model\n---\nLegacy prompt.\n';
const newAgent = '---\nname: builder\n---\nNew canonical prompt.\n';

const update = (): Effect.Effect<void, CommandError> => {
  const cursor = getPlatform('cursor');
  if (cursor === undefined) {
    throw new Error('Cursor platform is unavailable');
  }
  return cursor.update('0.1.0');
};

beforeEach(async () => {
  await rm(fixture.home, { force: true, recursive: true });
  const payload = path.join(fixture.home, 'payload/package');
  await mkdir(path.join(payload, 'agents/cursor'), { recursive: true });
  await writeFile(path.join(payload, 'agents/cursor/builder.md'), newAgent);
  await mkdir(path.join(pluginRoot, 'agents'), { recursive: true });
  await writeFile(path.join(pluginRoot, 'agents/builder.md'), originalAgent);
  fixture.archive = path.join(fixture.home, 'replacement.tgz');
  execFileSync('tar', ['-czf', fixture.archive, '-C', path.dirname(payload), 'package']);
  fixture.packCalls = 0;
});

afterAll(async () => {
  await rm(fixture.home, { force: true, recursive: true });
});

describe('Cursor consolidated package upgrade', () => {
  it('preserves a configured legacy model across actual archive replacement into the native host tree', async () => {
    await Effect.runPromise(update());
    const installed = await readFile(path.join(pluginRoot, 'agents/cursor/builder.md'), 'utf-8');
    expect(installed).toContain('model: legacy-model');
    expect(installed).toContain('New canonical prompt.');
    expect(installed).not.toContain('Legacy prompt.');
    expect(fixture.packCalls).toBe(1);
    await expect(
      readFile(path.join(pluginRoot, 'agents/builder.md'), 'utf-8'),
    ).rejects.toMatchObject({ code: 'ENOENT' });
    const evidence = path.join(repoRoot, 'artifacts/cursor-upgrade-evidence.json');
    await mkdir(path.dirname(evidence), { recursive: true });
    await writeFile(
      evidence,
      `${JSON.stringify(
        {
          from: 'agents/builder.md',
          installed,
          model: 'legacy-model',
          reproduction: 'pnpm --dir apps/maestria-cli exec vp test tests/cursor-upgrade.test.ts',
          result: 'passed',
          to: 'agents/cursor/builder.md',
        },
        null,
        2,
      )}\n`,
    );
  });

  it('keeps native-layout model settings ahead of stale legacy files', async () => {
    await mkdir(path.join(pluginRoot, 'agents/cursor'), { recursive: true });
    await writeFile(
      path.join(pluginRoot, 'agents/cursor/builder.md'),
      originalAgent.replace('legacy-model', 'current-model'),
    );
    await Effect.runPromise(update());
    const installed = await readFile(path.join(pluginRoot, 'agents/cursor/builder.md'), 'utf-8');
    expect(installed).toContain('model: current-model');
    expect(installed).not.toContain('legacy-model');
  });

  it('aborts before replacement when the native agent read fails for a reason other than absence', async () => {
    await mkdir(path.join(pluginRoot, 'agents/cursor/builder.md'), { recursive: true });
    await expect(Effect.runPromise(update())).rejects.toThrow(/EISDIR/u);
    expect(fixture.packCalls).toBe(0);
    expect(await readFile(path.join(pluginRoot, 'agents/builder.md'), 'utf-8')).toBe(originalAgent);
  });

  it('aborts before replacement when the legacy fallback read fails for a reason other than absence', async () => {
    await rm(path.join(pluginRoot, 'agents/builder.md'));
    await mkdir(path.join(pluginRoot, 'agents/builder.md'));
    await expect(Effect.runPromise(update())).rejects.toThrow(/EISDIR/u);
    expect(fixture.packCalls).toBe(0);
  });
});
