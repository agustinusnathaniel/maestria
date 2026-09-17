import { runCommand } from 'citty';
import { Effect } from 'effect';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { main } from '@/cli.js';
import type * as detect from '@/lib/detect.js';
import { version } from '^/package.json';

const detectMocks = vi.hoisted(() => ({
  detectAll: vi.fn(),
}));

vi.mock('@/lib/detect.js', async (importOriginal) => {
  const actual = await importOriginal<typeof detect>();
  return {
    ...actual,
    detectAll: detectMocks.detectAll,
  };
});

describe('CLI boundary', () => {
  const originalExitCode = process.exitCode;

  beforeEach(() => {
    vi.clearAllMocks();
    process.exitCode = undefined;
    detectMocks.detectAll.mockReturnValue(Effect.succeed([]));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.exitCode = originalExitCode;
    vi.restoreAllMocks();
  });

  it('does not render root status after a failing subcommand', async () => {
    await runCommand(main, { rawArgs: ['check', 'nope'] });

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Unknown platform: nope'));
    expect(console.log).not.toHaveBeenCalled();
    expect(detectMocks.detectAll).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  it('renders status once for the status subcommand', async () => {
    await runCommand(main, { rawArgs: ['status', '--compact', '--quiet'] });

    expect(detectMocks.detectAll).toHaveBeenCalledTimes(1);
    expect(console.log).toHaveBeenCalledTimes(1);
    expect(process.exitCode).toBe(0);
  });

  it('renders root status when no subcommand is given', async () => {
    await runCommand(main, { rawArgs: ['--quiet'] });

    expect(detectMocks.detectAll).toHaveBeenCalledTimes(1);
    expect(process.exitCode).toBe(0);
  });

  it('prints the version for --version without detecting platforms', async () => {
    await runCommand(main, { rawArgs: ['--version'] });

    expect(console.log).toHaveBeenCalledWith(version);
    expect(detectMocks.detectAll).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(0);
  });
});
