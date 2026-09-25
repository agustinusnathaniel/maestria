import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { CliError } from '@/lib/command-result.js';
import { toCommandRun } from '@/lib/command-runner.js';

describe('command runner', () => {
  const originalExitCode = process.exitCode;

  beforeEach(() => {
    process.exitCode = undefined;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.exitCode = originalExitCode;
    vi.restoreAllMocks();
  });

  it('prints non-empty output and records the exit code', async () => {
    await toCommandRun(async () => {
      await Promise.resolve();
      return { exitCode: 3, output: 'hello' };
    })({ args: {} });

    expect(console.log).toHaveBeenCalledWith('hello');
    expect(process.exitCode).toBe(3);
  });

  it('prints nothing for empty output and records exit code 0', async () => {
    await toCommandRun(async () => {
      await Promise.resolve();
      return { exitCode: 0, output: '' };
    })({ args: {} });

    expect(console.log).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(0);
  });

  it('writes CliError messages to stderr and records its exit code', async () => {
    await toCommandRun(() => {
      throw new CliError('bad', 1);
    })({ args: {} });

    expect(console.error).toHaveBeenCalledWith('bad');
    expect(console.log).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  it('records the exit code without printing for an empty CliError message', async () => {
    await toCommandRun(() => {
      throw new CliError('', 130);
    })({ args: {} });

    expect(console.error).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(130);
  });

  it('rethrows unknown errors', async () => {
    await expect(
      toCommandRun(() => {
        throw new Error('boom');
      })({ args: {} }),
    ).rejects.toThrow('boom');
    expect(process.exitCode).toBeUndefined();
  });
});
