import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { Effect } from 'effect';

import { handlePluginInstall } from '@/commands/plugin.js';
import type * as platforms from '@/lib/platforms.js';
import { CommandError } from '@/lib/shell.js';
import { CliError } from '@/lib/command-result.js';

const platformMocks = vi.hoisted(() => ({
  install: vi.fn(),
  version: vi.fn(),
}));

vi.mock('@/lib/platforms.js', async (importOriginal) => {
  const actual = await importOriginal<typeof platforms>();
  return {
    ...actual,
    installNpmTarball: platformMocks.install,
    readPackageJsonVersion: platformMocks.version,
  };
});

const tempDirectories: string[] = [];

const makeTempDirectory = async (): Promise<string> => {
  const directory = await mkdtemp(path.join(tmpdir(), 'maestria-plugin-'));
  tempDirectories.push(directory);
  return directory;
};

afterEach(async () => {
  vi.clearAllMocks();
  await Promise.all(
    tempDirectories.splice(0).map(async (directory) => {
      await rm(directory, { force: true, recursive: true });
    }),
  );
});

const captureCliError = async (promise: Promise<unknown>): Promise<CliError> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof CliError) {
      return error;
    }
    throw error;
  }
  throw new Error('Expected handler to throw CliError');
};

describe('plugin install handler', () => {
  it('stages the maestria package into the default cache destination', async () => {
    const parent = await makeTempDirectory();
    const cache = path.join(parent, 'cache');
    vi.stubEnv('XDG_CACHE_HOME', cache);
    platformMocks.install.mockReturnValue(Effect.void);
    platformMocks.version.mockReturnValue(Effect.succeed('1.2.3'));

    const result = await handlePluginInstall({});

    const expected = path.join(cache, 'maestria', 'agent-plugins', 'maestria');
    expect(platformMocks.install).toHaveBeenCalledTimes(1);
    expect(platformMocks.install).toHaveBeenCalledWith('@maestria/agent-plugins', expected);
    expect(result.exitCode).toBe(0);
    expect(result.output).toBe(
      `Staged @maestria/agent-plugins@1.2.3 at ${expected}\nPoint a compatible client at this directory to load the package.`,
    );
    vi.unstubAllEnvs();
  });

  it('stages into an explicit new destination', async () => {
    const parent = await makeTempDirectory();
    const destination = path.join(parent, 'staged');
    platformMocks.install.mockReturnValue(Effect.void);
    platformMocks.version.mockReturnValue(Effect.succeed('1.2.3'));

    const result = await handlePluginInstall({ destination });

    expect(platformMocks.install).toHaveBeenCalledWith('@maestria/agent-plugins', destination);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain(`at ${destination}`);
  });

  it('refuses an existing explicit destination without staging', async () => {
    const parent = await makeTempDirectory();
    const destination = path.join(parent, 'existing');
    await mkdir(destination, { recursive: true });
    await writeFile(path.join(destination, 'marker.txt'), 'keep');

    const error = await captureCliError(handlePluginInstall({ destination }));

    expect(error.exitCode).toBe(1);
    expect(error.message).toBe(
      `Destination already exists: ${destination}. Choose another destination or remove it first.`,
    );
    expect(platformMocks.install).not.toHaveBeenCalled();
    expect(await readFile(path.join(destination, 'marker.txt'), 'utf-8')).toBe('keep');
  });

  it('returns destination, package, and version as JSON', async () => {
    const parent = await makeTempDirectory();
    const destination = path.join(parent, 'staged');
    platformMocks.install.mockReturnValue(Effect.void);
    platformMocks.version.mockReturnValue(Effect.succeed('9.9.9'));

    const result = await handlePluginInstall({ destination, json: true });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.output)).toEqual({
      destination,
      package: '@maestria/agent-plugins',
      version: '9.9.9',
    });
  });

  it('throws CliError when staging fails', async () => {
    const parent = await makeTempDirectory();
    platformMocks.install.mockReturnValue(
      Effect.fail(new CommandError({ command: 'npm pack', message: 'nope' })),
    );

    const error = await captureCliError(
      handlePluginInstall({ destination: path.join(parent, 'staged') }),
    );

    expect(error.exitCode).toBe(1);
  });
});
