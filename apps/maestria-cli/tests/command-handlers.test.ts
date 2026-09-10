import { Effect } from 'effect';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { handleRoot } from '@/cli.js';
import { handleCheck } from '@/commands/check.js';
import { handleInstall } from '@/commands/install.js';
import { handleStatus } from '@/commands/status.js';
import { handleUninstall } from '@/commands/uninstall.js';
import { handleUpdate } from '@/commands/update.js';
import { CliError } from '@/lib/command-result.js';
import type * as detect from '@/lib/detect.js';
import type * as platforms from '@/lib/platforms.js';
import type { PlatformHandler, PlatformId } from '@/lib/platforms.js';
import type { PlatformResult, PlatformStatus } from '@/types.js';
import { version } from '^/package.json';

const platformMocks = vi.hoisted(() => ({
  getPlatform: vi.fn<(id: string) => PlatformHandler | undefined>(),
}));
const detectMocks = vi.hoisted(() => ({
  detectAll: vi.fn(),
  detectInstalled: vi.fn(),
  detectSingle: vi.fn(),
}));
const transactionMocks = vi.hoisted(() => ({
  installOne: vi.fn<(platform: PlatformHandler, quiet: boolean) => Effect.Effect<PlatformResult>>(),
  uninstallOne:
    vi.fn<(platform: PlatformHandler, quiet: boolean) => Effect.Effect<PlatformResult>>(),
  updateOne:
    vi.fn<
      (platform: PlatformHandler, quiet: boolean, version?: string) => Effect.Effect<PlatformResult>
    >(),
}));
const promptMocks = vi.hoisted(() => ({
  cancel: vi.fn(),
  isCancel: vi.fn(() => false),
  select: vi.fn(),
  spinner: vi.fn(() => ({ message: vi.fn(), start: vi.fn(), stop: vi.fn() })),
}));

vi.mock('@/lib/platforms.js', async (importOriginal) => {
  const actual = await importOriginal<typeof platforms>();
  return {
    ...actual,
    getPlatform: platformMocks.getPlatform,
    getPlatformOrResult: (id: string, fallbackLabel?: string) =>
      platformMocks.getPlatform(id) ?? actual.getPlatformOrResult(id, fallbackLabel),
  };
});

vi.mock('@/lib/detect.js', async (importOriginal) => {
  const actual = await importOriginal<typeof detect>();
  return {
    ...actual,
    detectAll: detectMocks.detectAll,
    detectInstalled: detectMocks.detectInstalled,
    detectSingle: detectMocks.detectSingle,
  };
});

vi.mock('@/lib/platform-transaction.js', () => ({
  installOne: transactionMocks.installOne,
  uninstallOne: transactionMocks.uninstallOne,
  updateOne: transactionMocks.updateOne,
}));

vi.mock('@clack/prompts', () => ({
  cancel: promptMocks.cancel,
  isCancel: promptMocks.isCancel,
  select: promptMocks.select,
  spinner: promptMocks.spinner,
}));

const noopEffect = Effect.sync(() => {});

const makePlatform = (id: PlatformId, label: string): PlatformHandler => ({
  detect: Effect.succeed(true),
  getInstalledVersion: Effect.succeed('1.0.0'),
  getLatestVersion: Effect.succeed('1.0.0'),
  id,
  install: noopEffect,
  isInstalled: Effect.succeed(true),
  label,
  uninstall: noopEffect,
  update: () => noopEffect,
});

const handlers = new Map<string, PlatformHandler>([
  ['opencode', makePlatform('opencode', 'OpenCode')],
  ['pi', makePlatform('pi', 'Pi')],
]);

const status = (overrides: Partial<PlatformStatus>): PlatformStatus => ({
  available: true,
  id: 'opencode',
  installed: true,
  installedVersion: '1.0.0',
  label: 'OpenCode',
  latestVersion: '1.0.0',
  ...overrides,
});

const platformResult = (id: string, label: string, ok: boolean): PlatformResult =>
  ok
    ? { id, label, message: 'Installed', nextVersion: '1.2.3', ok }
    : { id, label, message: 'Failed', ok };

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

const stdoutTty = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');
const stdinTty = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');

const setTty = (value: boolean): void => {
  Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value });
  Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value });
};

const restoreTty = (): void => {
  if (stdoutTty) {
    Object.defineProperty(process.stdout, 'isTTY', stdoutTty);
  } else {
    Reflect.deleteProperty(process.stdout, 'isTTY');
  }
  if (stdinTty) {
    Object.defineProperty(process.stdin, 'isTTY', stdinTty);
  } else {
    Reflect.deleteProperty(process.stdin, 'isTTY');
  }
};

describe('command handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    platformMocks.getPlatform.mockImplementation((id: string) => handlers.get(id));
    detectMocks.detectAll.mockReturnValue(Effect.succeed([]));
    detectMocks.detectInstalled.mockReturnValue(Effect.succeed([]));
    detectMocks.detectSingle.mockImplementation((id: string) =>
      Effect.succeed(status({ id, label: handlers.get(id)?.label ?? id })),
    );
    transactionMocks.installOne.mockImplementation((platform: PlatformHandler) =>
      Effect.succeed(platformResult(platform.id, platform.label, true)),
    );
    transactionMocks.uninstallOne.mockImplementation((platform: PlatformHandler) =>
      Effect.succeed({ id: platform.id, label: platform.label, message: 'Uninstalled', ok: true }),
    );
    transactionMocks.updateOne.mockImplementation((platform: PlatformHandler) =>
      Effect.succeed({ id: platform.id, label: platform.label, message: 'Updated', ok: true }),
    );
    promptMocks.isCancel.mockReturnValue(false);
  });

  afterEach(() => {
    restoreTty();
    vi.restoreAllMocks();
  });

  describe('status', () => {
    it('renders the plain status table with exit code 0', async () => {
      detectMocks.detectAll.mockReturnValue(Effect.succeed([status({})]));

      const result = await handleStatus({ quiet: true });

      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('Maestria Status');
      expect(result.output).toContain('OpenCode');
    });

    it('renders JSON status with exit code 0', async () => {
      const platformsStatus = [status({})];
      detectMocks.detectAll.mockReturnValue(Effect.succeed(platformsStatus));

      const result = await handleStatus({ json: true, quiet: true });

      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.output)).toEqual({ platforms: platformsStatus });
    });

    it('renders compact status with exit code 0', async () => {
      detectMocks.detectAll.mockReturnValue(Effect.succeed([status({})]));

      const result = await handleStatus({ compact: true });

      expect(result).toEqual({
        exitCode: 0,
        output: 'opencode: available installed=1.0.0 latest=1.0.0\n',
      });
    });
  });

  describe('check', () => {
    it('returns exit code 0 for a current installation', async () => {
      const result = await handleCheck({ platform: 'opencode' });

      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('@maestria/opencode is installed for OpenCode (v1.0.0)');
    });

    it('returns exit code 3 for an outdated installation', async () => {
      detectMocks.detectSingle.mockReturnValue(
        Effect.succeed(status({ installedVersion: '1.0.0', latestVersion: '2.0.0' })),
      );

      const result = await handleCheck({ platform: 'opencode' });

      expect(result.exitCode).toBe(3);
      expect(result.output).toContain('update available: v1.0.0 -> v2.0.0');
    });

    it('returns exit code 1 with the not-installed message', async () => {
      detectMocks.detectSingle.mockReturnValue(
        Effect.succeed(status({ installed: false, installedVersion: '' })),
      );

      const result = await handleCheck({ platform: 'opencode' });

      expect(result).toEqual({
        exitCode: 1,
        output: '@maestria/opencode is not installed for OpenCode',
      });
    });

    it('throws CliError for an unknown platform', async () => {
      const error = await captureCliError(handleCheck({ platform: 'nope' }));

      expect(error.exitCode).toBe(1);
      expect(error.message).toContain('Unknown platform: nope');
    });

    it('throws CliError when --all is combined with a platform', async () => {
      const error = await captureCliError(handleCheck({ all: true, platform: 'opencode' }));

      expect(error.exitCode).toBe(1);
      expect(error.message).toBe('Cannot use --all with a specific platform. Choose one.');
    });

    it('returns exit code 3 when every checked platform is installed and outdated', async () => {
      detectMocks.detectAll.mockReturnValue(
        Effect.succeed([
          status({ installedVersion: '1.0.0', latestVersion: '2.0.0' }),
          status({ id: 'pi', installedVersion: '1.0.0', label: 'Pi', latestVersion: '2.0.0' }),
        ]),
      );

      const result = await handleCheck({ all: true, json: true });

      expect(result.exitCode).toBe(3);
    });

    it('returns exit code 1 when a checked platform is not installed', async () => {
      detectMocks.detectAll.mockReturnValue(
        Effect.succeed([
          status({}),
          status({ id: 'pi', installed: false, installedVersion: '', label: 'Pi' }),
        ]),
      );

      const result = await handleCheck({ all: true, json: true });

      expect(result.exitCode).toBe(1);
    });
  });

  describe('install', () => {
    it('installs a direct platform selection', async () => {
      const result = await handleInstall({ compact: true, platform: 'opencode', quiet: true });

      expect(transactionMocks.installOne).toHaveBeenCalledTimes(1);
      expect(result.exitCode).toBe(0);
    });

    it('installs all installable detected platforms', async () => {
      detectMocks.detectAll.mockReturnValue(
        Effect.succeed([
          status({ installed: false, installedVersion: '' }),
          status({ id: 'pi', installed: false, installedVersion: '', label: 'Pi' }),
        ]),
      );

      const result = await handleInstall({ all: true, quiet: true });

      expect(transactionMocks.installOne).toHaveBeenCalledTimes(2);
      expect(result.exitCode).toBe(0);
    });

    it('reports already-installed platforms without running installs', async () => {
      detectMocks.detectAll.mockReturnValue(Effect.succeed([status({})]));

      const result = await handleInstall({ all: true, quiet: true });

      expect(transactionMocks.installOne).not.toHaveBeenCalled();
      expect(result).toEqual({
        exitCode: 0,
        output: 'All detected platforms already have maestria installed.',
      });
    });

    it('throws CliError when no platform is given outside a TTY', async () => {
      setTty(false);

      const error = await captureCliError(handleInstall({}));

      expect(error.exitCode).toBe(1);
      expect(error.message).toContain('No platform specified and not in an interactive terminal.');
    });
  });

  describe('uninstall', () => {
    it('uninstalls a direct platform selection', async () => {
      const result = await handleUninstall({ platform: 'opencode', quiet: true });

      expect(transactionMocks.uninstallOne).toHaveBeenCalledTimes(1);
      expect(result.exitCode).toBe(0);
    });

    it('uninstalls all detected platforms', async () => {
      detectMocks.detectInstalled.mockReturnValue(Effect.succeed([status({})]));

      const result = await handleUninstall({ all: true, quiet: true });

      expect(transactionMocks.uninstallOne).toHaveBeenCalledTimes(1);
      expect(result.exitCode).toBe(0);
    });

    it('reports an empty install set', async () => {
      detectMocks.detectInstalled.mockReturnValue(Effect.succeed([]));

      const result = await handleUninstall({ all: true, quiet: true });

      expect(result).toEqual({
        exitCode: 0,
        output: 'No maestria installations found to uninstall.',
      });
    });

    it('throws CliError for an unknown platform', async () => {
      const error = await captureCliError(handleUninstall({ platform: 'nope' }));

      expect(error.exitCode).toBe(1);
      expect(error.message).toContain('Unknown platform: nope');
    });

    it('returns exit code 130 when the interactive picker is cancelled', async () => {
      setTty(true);
      detectMocks.detectInstalled.mockReturnValue(Effect.succeed([status({})]));
      promptMocks.select.mockResolvedValue(Symbol('cancel'));
      promptMocks.isCancel.mockReturnValue(true);

      const error = await captureCliError(handleUninstall({}));

      expect(promptMocks.cancel).toHaveBeenCalledWith('Uninstall cancelled.');
      expect(error.exitCode).toBe(130);
      expect(error.message).toBe('');
    });
  });

  describe('update', () => {
    it('updates a direct platform selection', async () => {
      const result = await handleUpdate({ platform: 'opencode', quiet: true, version: '1.0.0' });

      expect(transactionMocks.updateOne).toHaveBeenCalledTimes(1);
      expect(result.exitCode).toBe(0);
    });

    it('updates all installed platforms', async () => {
      detectMocks.detectInstalled.mockReturnValue(Effect.succeed([status({})]));

      const result = await handleUpdate({ all: true, quiet: true });

      expect(transactionMocks.updateOne).toHaveBeenCalledTimes(1);
      expect(result.exitCode).toBe(0);
    });

    it('reports an empty install set', async () => {
      detectMocks.detectInstalled.mockReturnValue(Effect.succeed([]));

      const result = await handleUpdate({ all: true, quiet: true });

      expect(result).toEqual({ exitCode: 0, output: 'No maestria installations found to update.' });
    });

    it('reports up-to-date platforms in the interactive flow', async () => {
      setTty(true);
      detectMocks.detectInstalled.mockReturnValue(Effect.succeed([status({})]));

      const result = await handleUpdate({});

      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('All platforms are up to date.');
    });

    it('returns the batch failure exit code when one update fails', async () => {
      transactionMocks.updateOne
        .mockImplementationOnce((platform: PlatformHandler) =>
          Effect.succeed({ id: platform.id, label: platform.label, message: 'Updated', ok: true }),
        )
        .mockImplementationOnce((platform: PlatformHandler) =>
          Effect.succeed({ id: platform.id, label: platform.label, message: 'Failed', ok: false }),
        );

      const result = await handleUpdate({ platform: 'opencode,pi', quiet: true });

      expect(result.exitCode).toBe(1);
    });
  });

  describe('root', () => {
    it('returns the version for --version', async () => {
      const result = await handleRoot({ version: true });

      expect(result).toEqual({ exitCode: 0, output: version });
    });

    it('shares the status flow with the status command', async () => {
      detectMocks.detectAll.mockReturnValue(Effect.succeed([status({})]));

      const rootResult = await handleRoot({ json: true, quiet: true });
      const statusResult = await handleStatus({ json: true, quiet: true });

      expect(rootResult).toEqual(statusResult);
    });
  });
});
