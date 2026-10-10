import { Effect } from 'effect';
import { tmpdir as osTmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { getPlatform } from '@/lib/platforms.js';
import type { PlatformHandler } from '@/lib/platforms.js';
import * as shell from '@/lib/shell.js';

type ReadFile = (filePath: string, encoding: 'utf-8') => Promise<string>;
type Mkdtemp = (prefix: string) => Promise<string>;
type Remove = (
  filePath: string,
  options?: { recursive?: boolean; force?: boolean },
) => Promise<void>;
interface FsPromisesModule {
  readFile: ReadFile;
  mkdtemp: Mkdtemp;
  rm: Remove;
}

// State shared between the hoisted mock factory and the tests: the stubbed
// `readFile` (installed version lookups read package.json through Node's
// cross-platform fs/promises API, not a POSIX `cat`) plus the stubbed
// `mkdtemp`/`rm` and handles on the real implementations for the helper test
// that exercises the actual filesystem.
const fsMocks = vi.hoisted(() => {
  let originalReadFile: ReadFile | undefined;
  let originalMkdtemp: Mkdtemp | undefined;
  let originalRm: Remove | undefined;
  return {
    access: vi.fn(async () => {}),
    getOriginalReadFile() {
      return originalReadFile;
    },
    mkdtemp: vi.fn(async (prefix: string) => {
      if (!originalMkdtemp) {
        throw new Error('original mkdtemp unavailable');
      }
      return await originalMkdtemp(prefix);
    }),
    readFile: vi.fn((filePath: string) => {
      if (filePath.endsWith('/.maestria-agents.json')) {
        return JSON.stringify({ files: [], version: 1 });
      }
      return JSON.stringify({ version: '0.2.0' });
    }),
    rm: vi.fn(async (filePath: string, options?: { recursive?: boolean; force?: boolean }) => {
      if (!originalRm) {
        throw new Error('original rm unavailable');
      }
      await originalRm(filePath, options);
    }),
    setOriginals(readFile: ReadFile, mkdtemp: Mkdtemp, rm: Remove) {
      originalReadFile = readFile;
      originalMkdtemp = mkdtemp;
      originalRm = rm;
    },
  };
});

vi.mock('@/lib/shell.js', async (importOriginal) => {
  const actual = await importOriginal<typeof shell>();
  return {
    ...actual,
    commandExists: vi.fn((cmd: string) => actual.commandExists(cmd)),
    fileExists: vi.fn((filePath: string) => actual.fileExists(filePath)),
    // Return a real Effect so module-evaluation .pipe() chains in platforms.ts
    // keep working; executing it resolves without spawning any subprocess.
    readTextFile: vi.fn((filePath: string) => actual.readTextFile(filePath)),
    run: vi.fn((_cmd: string, _args: string[], _timeoutMs?: number) => Effect.succeed('')),
  };
});

// Installed package versions are read through Node's cross-platform
// fs/promises API. Stubbing those functions keeps the tests deterministic
// without touching the real filesystem.
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<FsPromisesModule>();
  fsMocks.setOriginals(actual.readFile, actual.mkdtemp, actual.rm);
  return {
    ...actual,
    access: fsMocks.access,
    mkdtemp: fsMocks.mkdtemp,
    readFile: fsMocks.readFile,
    rm: fsMocks.rm,
  };
});

// Handlers construct their run(...) effects at module load, so the command a
// handler issues is visible in the recorded calls. Filter to pi uninstall to
// isolate this handler from other platforms' module-load calls.
const requirePlatform = (id: string): PlatformHandler => {
  const platform = getPlatform(id);
  if (platform === undefined) {
    throw new Error(`Platform not found: ${id}`);
  }
  return platform;
};

// Canned stdout for one host command; anything else resolves empty so each
// test observes exactly the interaction under test.
const mockHostCommand = (binary: string, argsJoined: string, output: string): void => {
  vi.mocked(shell.run).mockImplementation((cmd, args) =>
    cmd === binary && args.join(' ') === argsJoined ? Effect.succeed(output) : Effect.succeed(''),
  );
};

const piUninstallCalls = (): string[][] =>
  vi
    .mocked(shell.run)
    .mock.calls.filter((call) => call[0] === 'pi' && call[1]?.[0] === 'uninstall')
    .map((call) => call[1]);

describe('pi platform uninstall', () => {
  it('uninstalls @maestria/pi with the npm: package reference', async () => {
    const pi = requirePlatform('pi');
    expect(pi).toBeDefined();
    // Executing the effect must resolve cleanly (no subprocess under the mock)
    await Effect.runPromise(pi.uninstall);

    const uninstalls = piUninstallCalls();
    expect(uninstalls).toHaveLength(1);
    expect(uninstalls[0]).toEqual(['uninstall', 'npm:@maestria/pi']);
  });

  it('does not uninstall the shared pi-subagents prerequisite', async () => {
    const pi = requirePlatform('pi');
    expect(pi).toBeDefined();
    await Effect.runPromise(pi.uninstall);

    const uninstalls = piUninstallCalls();
    expect(uninstalls).toHaveLength(1);
    expect(uninstalls[0]).not.toContain('@gotgenes/pi-subagents');
  });
});

describe('pi subagent prerequisite', () => {
  it('pins the pi-subagents peer to a range instead of installing bare latest', () => {
    // The prerequisite effect is built at module load, so its run(...) call is
    // already recorded; assert before any test clears the shared mock.
    const prerequisite = vi
      .mocked(shell.run)
      .mock.calls.find(
        (call) => call[0] === 'pi' && call[1]?.[1]?.startsWith('npm:@gotgenes/pi-subagents'),
      );

    const spec = prerequisite?.[1]?.[1] ?? '';
    // The peer range lives in the workspace catalog; pinning bare `latest`
    // here installed versions the @maestria/pi peer range can reject.
    expect(spec).toMatch(/^npm:@gotgenes\/pi-subagents@\^\d+\.\d+\.\d+$/u);
  });
});

describe('pi and omp package commands', () => {
  it('drives install, update, and uninstall with exact command arrays', async () => {
    // Uninstall effects are built at module load, so the recorded call is the
    // one the handler holds; assert it before clearing the shared mock.
    const ompUninstall = vi
      .mocked(shell.run)
      .mock.calls.find(
        (call) => call[0] === 'omp' && call[1]?.[0] === 'plugin' && call[1]?.[1] === 'uninstall',
      );
    expect(ompUninstall?.[1]).toEqual(['plugin', 'uninstall', '@maestria/agent-plugins']);

    vi.clearAllMocks();
    const pi = requirePlatform('pi');
    const omp = requirePlatform('omp');

    await Effect.runPromise(pi.install);
    await Effect.runPromise(pi.update());
    await Effect.runPromise(pi.update('1.2.3'));
    await Effect.runPromise(omp.install);
    await Effect.runPromise(omp.update());
    await Effect.runPromise(omp.update('1.2.3'));

    const calls = vi
      .mocked(shell.run)
      .mock.calls.filter((call) => call[0] === 'pi' || call[0] === 'omp')
      .map(([cmd, args, timeoutMs]) => [cmd, args, timeoutMs]);

    expect(calls).toContainEqual(['pi', ['install', 'npm:@maestria/pi'], 120_000]);
    expect(calls).toContainEqual(['pi', ['install', 'npm:@maestria/pi@latest'], 120_000]);
    expect(calls).toContainEqual(['pi', ['install', 'npm:@maestria/pi@1.2.3'], 120_000]);
    expect(calls).toContainEqual([
      'omp',
      ['plugin', 'install', '@maestria/agent-plugins'],
      120_000,
    ]);
    expect(calls).toContainEqual([
      'omp',
      ['plugin', 'install', '@maestria/agent-plugins@latest'],
      120_000,
    ]);
    expect(calls).toContainEqual([
      'omp',
      ['plugin', 'install', '@maestria/agent-plugins@1.2.3'],
      120_000,
    ]);
  });
});

describe('hermes portable plugin commands', () => {
  it('keeps the legacy adapter enabled when the replacement install fails', async () => {
    vi.clearAllMocks();
    vi.mocked(shell.run).mockImplementationOnce(() =>
      Effect.fail(
        new shell.CommandError({ command: 'hermes plugins install', message: 'install failed' }),
      ),
    );
    await expect(Effect.runPromise(requirePlatform('hermes').install)).rejects.toBeDefined();
    expect(vi.mocked(shell.run).mock.calls.some(([, args]) => args[1] === 'disable')).toBe(false);
  });

  it('reports the portable plugin identity without a Python adapter', async () => {
    const hermes = requirePlatform('hermes');
    expect(hermes.npmPackage).toBe('@maestria/agent-plugins');
    expect(await Effect.runPromise(hermes.getInstalledVersion)).toBe('0.2.0');
    vi.clearAllMocks();
    await Effect.runPromise(hermes.uninstall);
    expect(shell.run).toHaveBeenCalledWith('hermes', ['plugins', 'remove', 'maestria'], 15_000);
  });

  it('gives the git-based install and update the same generous deadline', async () => {
    vi.clearAllMocks();
    const hermes = requirePlatform('hermes');

    await Effect.runPromise(hermes.install);
    await Effect.runPromise(hermes.update());

    const calls = vi
      .mocked(shell.run)
      .mock.calls.filter((call) => call[0] === 'hermes')
      .map(([, args, timeoutMs]) => [...args, timeoutMs]);

    expect(calls).toContainEqual([
      'plugins',
      'install',
      'agustinusnathaniel/maestria/packages/agent-plugins/plugin',
      '--enable',
      120_000,
    ]);
    expect(calls).toContainEqual(['plugins', 'disable', 'maestria-hermes', 15_000]);
    expect(calls).toContainEqual(['plugins', 'update', 'maestria', 120_000]);
  });
});

describe('opencode platform update', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('gives the host plugin fetch the same generous deadline as install', async () => {
    // Isolate from the real home/cache dirs: update() clears the opencode
    // package cache and reads the global config, which must never touch the
    // developer machine running the suite. Point both at a nonexistent
    // sandbox (missing cache dir is a graceful no-op; missing config reads
    // as not-globally-installed).
    const sandbox = path.join(osTmpdir(), `maestria-opencode-test-${process.pid}`);
    vi.stubEnv('XDG_CACHE_HOME', path.join(sandbox, 'cache'));
    vi.stubEnv('HOME', sandbox);

    vi.clearAllMocks();
    const opencode = requirePlatform('opencode');

    await Effect.runPromise(opencode.update());

    const updates = vi
      .mocked(shell.run)
      .mock.calls.filter((call) => call[0] === 'opencode' && call[1]?.[0] === 'plugin');
    expect(updates).toHaveLength(1);
    expect(updates[0]?.[1]).toContain('--force');
    expect(updates[0]?.[2]).toBe(120_000);
  });
});

describe('marketplace-backed platform handlers', () => {
  it('registers the native adapters with the consolidated plugin package', () => {
    const claudeCode = getPlatform('claude-code');
    const codex = getPlatform('codex');
    const cursor = getPlatform('cursor');
    const kimiCode = getPlatform('kimi-code');

    expect(claudeCode?.npmPackage).toBe('@maestria/agent-plugins');
    expect(codex?.npmPackage).toBe('@maestria/agent-plugins');
    expect(cursor?.npmPackage).toBe('@maestria/agent-plugins');
    expect(kimiCode?.npmPackage).toBe('@maestria/agent-plugins');
    expect(claudeCode?.supportsVersionPinning).toBe(false);
    expect(codex?.supportsVersionPinning).toBe(false);
  });

  it('recognizes the installed Claude Code plugin from host JSON', async () => {
    mockHostCommand(
      'claude',
      'plugin list --json',
      JSON.stringify([
        {
          id: 'maestria@maestria',
          name: 'maestria',
          version: '0.2.1',
        },
      ]),
    );

    const claudeCode = requirePlatform('claude-code');
    expect(await Effect.runPromise(claudeCode.isInstalled)).toBe(true);
    expect(await Effect.runPromise(claudeCode.getInstalledVersion)).toBe('0.2.1');
  });

  it('recognizes the installed Codex CLI plugin from host JSON', async () => {
    mockHostCommand(
      'codex',
      'plugin list --json',
      JSON.stringify({
        installed: [
          {
            marketplaceName: 'maestria',
            name: 'maestria',
            pluginId: 'maestria@maestria',
            version: '0.2.0',
          },
        ],
      }),
    );

    const codex = requirePlatform('codex');
    expect(await Effect.runPromise(codex.isInstalled)).toBe(true);
    expect(await Effect.runPromise(codex.getInstalledVersion)).toBe('0.2.0');
  });

  it('uses host-native uninstall commands', async () => {
    vi.clearAllMocks();

    await Effect.runPromise(requirePlatform('claude-code').uninstall);
    await Effect.runPromise(requirePlatform('codex').uninstall);

    const calls = vi
      .mocked(shell.run)
      .mock.calls.filter((call) => call[0] === 'claude' || call[0] === 'codex')
      .map(([cmd, args]) => [cmd, ...args]);

    expect(calls).toContainEqual([
      'claude',
      'plugin',
      'uninstall',
      'maestria@maestria',
      '--scope',
      'user',
      '--yes',
    ]);
    expect(calls).toContainEqual(['codex', 'plugin', 'remove', 'maestria@maestria', '--json']);
  });
});

describe('Cursor platform detection', () => {
  it('accepts the cursor-agent alias', async () => {
    vi.mocked(shell.commandExists).mockImplementation((cmd) =>
      Effect.succeed(cmd === 'cursor-agent'),
    );
    vi.mocked(shell.run).mockImplementation((cmd, args) => {
      if (cmd === 'which' && args[0] === 'cursor-agent') {
        return Effect.succeed('/usr/local/bin/cursor-agent');
      }
      return Effect.succeed('');
    });

    const cursor = requirePlatform('cursor');
    expect(await Effect.runPromise(cursor.detect)).toBe(true);
  });

  it('does not treat an unrelated agent binary as Cursor', async () => {
    vi.mocked(shell.commandExists).mockImplementation((cmd) => Effect.succeed(cmd === 'agent'));
    vi.mocked(shell.run).mockImplementation((cmd, args) => {
      if (cmd === 'which' && args[0] === 'agent') {
        return Effect.succeed('/usr/local/bin/agent');
      }
      if (cmd === 'agent' && args[0] === '--version') {
        return Effect.succeed('Grok Build TUI 1.0.0');
      }
      return Effect.succeed('');
    });

    const cursor = requirePlatform('cursor');
    expect(await Effect.runPromise(cursor.detect)).toBe(false);
  });
});

describe('Kimi Code platform registration', () => {
  it('recognizes the native installed.json registry instead of a global AGENTS.md marker', async () => {
    const previousHome = process.env.KIMI_CODE_HOME;
    process.env.KIMI_CODE_HOME = '/tmp/maestria-kimi-test';
    fsMocks.readFile.mockImplementation((filePath: string) => {
      if (filePath.endsWith('/plugins/installed.json')) {
        return JSON.stringify({
          plugins: [
            {
              enabled: true,
              id: 'maestria',
              installedAt: '2026-08-26T00:00:00.000Z',
              root: '/tmp/maestria-kimi-test/plugins/managed/maestria',
              source: 'local-path',
            },
          ],
          version: 1,
        });
      }
      return JSON.stringify({ version: '0.2.0' });
    });

    try {
      const kimi = requirePlatform('kimi-code');
      expect(await Effect.runPromise(kimi.isInstalled)).toBe(true);
    } finally {
      if (previousHome === undefined) {
        delete process.env.KIMI_CODE_HOME;
      } else {
        process.env.KIMI_CODE_HOME = previousHome;
      }
    }
  });
});
