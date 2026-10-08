import { Effect } from 'effect';
import { expect, it, vi } from 'vite-plus/test';

import { detectAll, detectInstalled } from '@/lib/detect.js';

const reads = vi.hoisted(() => ({ latest: 0 }));

vi.mock('@/lib/platforms.js', () => {
  const platform = {
    detect: Effect.succeed(true),
    getInstalledVersion: Effect.succeed('1.0.0'),
    getLatestVersion: Effect.sync(() => {
      reads.latest += 1;
      return '2.0.0';
    }),
    id: 'opencode',
    isInstalled: Effect.succeed(true),
    label: 'OpenCode',
  };
  return { getPlatform: () => platform, platforms: [platform] };
});

it('skips latest-version reads only when the caller opts out', async () => {
  const light = await Effect.runPromise(detectAll({ includeLatest: false }));
  expect(light).toMatchObject([
    { id: 'opencode', installed: true, installedVersion: '1.0.0', latestVersion: '' },
  ]);
  expect(reads.latest).toBe(0);

  const full = await Effect.runPromise(detectAll());
  expect(full[0]?.latestVersion).toBe('2.0.0');
  expect(reads.latest).toBe(1);

  const installed = await Effect.runPromise(detectInstalled({ includeLatest: false }));
  expect(installed[0]?.latestVersion).toBe('');
  expect(reads.latest).toBe(1);
});
