import { describe, it, expect, vi } from 'vite-plus/test';
import { Effect } from 'effect';

// State shared between the hoisted mock factory and the tests: the stubbed
// `readFile` (the Prime version lookup reads package.json through Node's
// cross-platform fs/promises API, not a POSIX `cat`) plus the stubbed
// `mkdtemp`/`rm` (the Prime handler creates and removes an isolated temp cwd
// around every package command) and handles on the real implementations for
// the helper test that exercises the actual filesystem.
const fsMocks = vi.hoisted(() => {
  let originalReadFile: (typeof import('node:fs/promises'))['readFile'] | undefined;
  let originalMkdtemp: (typeof import('node:fs/promises'))['mkdtemp'] | undefined;
  let originalRm: (typeof import('node:fs/promises'))['rm'] | undefined;
  return {
    readFile: vi.fn(async (_path: string) => JSON.stringify({ version: '0.2.0' })),
    mkdtemp: vi.fn(async (prefix: string) => {
      if (!originalMkdtemp) throw new Error('original mkdtemp unavailable');
      return originalMkdtemp(prefix);
    }),
    rm: vi.fn(async (path: string, options?: { recursive?: boolean; force?: boolean }) => {
      if (!originalRm) throw new Error('original rm unavailable');
      return originalRm(path, options);
    }),
    setOriginals(
      readFile: (typeof import('node:fs/promises'))['readFile'],
      mkdtemp: (typeof import('node:fs/promises'))['mkdtemp'],
      rm: (typeof import('node:fs/promises'))['rm'],
    ) {
      originalReadFile = readFile;
      originalMkdtemp = mkdtemp;
      originalRm = rm;
    },
    getOriginalReadFile() {
      return originalReadFile;
    },
  };
});

vi.mock('@/lib/shell.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/shell.js')>();
  return {
    ...actual,
    commandExists: vi.fn((cmd: string) => actual.commandExists(cmd)),
    // Return a real Effect so module-evaluation .pipe() chains in platforms.ts
    // keep working; executing it resolves without spawning any subprocess.
    run: vi.fn((_cmd: string, _args: string[], _timeoutMs?: number) => Effect.succeed('')),
    sh: vi.fn((_command: string, _timeoutMs?: number) => Effect.succeed('')),
  };
});

// The Prime adapter reads installed package versions through Node's
// cross-platform fs/promises API and creates/removes an isolated temp cwd
// around every package command. Stubbing those functions keeps the tests
// deterministic without touching the real filesystem; the real reads are
// proven by the readPackageJsonVersion test below.
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  fsMocks.setOriginals(actual.readFile, actual.mkdtemp, actual.rm);
  return {
    ...actual,
    readFile: fsMocks.readFile,
    mkdtemp: fsMocks.mkdtemp,
    rm: fsMocks.rm,
  };
});

import * as shell from '@/lib/shell.js';
import { getPlatform, readPackageJsonVersion } from '@/lib/platforms.js';

// Handlers construct their run(...) effects at module load, so the command a
// handler issues is visible in the recorded calls. Filter to pi uninstall to
// isolate this handler from other platforms' module-load calls.
function piUninstallCalls(): string[][] {
  return vi
    .mocked(shell.run)
    .mock.calls.filter((call) => call[0] === 'pi' && call[1]?.[0] === 'uninstall')
    .map((call) => call[1]);
}

describe('pi platform uninstall', () => {
  it('uninstalls @maestria/pi with the npm: package reference', async () => {
    const pi = getPlatform('pi');
    expect(pi).toBeDefined();
    // Executing the effect must resolve cleanly (no subprocess under the mock)
    await Effect.runPromise(pi!.uninstall);

    const uninstalls = piUninstallCalls();
    expect(uninstalls).toHaveLength(1);
    expect(uninstalls[0]).toEqual(['uninstall', 'npm:@maestria/pi']);
  });

  it('does not uninstall the shared pi-subagents prerequisite', async () => {
    const pi = getPlatform('pi');
    expect(pi).toBeDefined();
    await Effect.runPromise(pi!.uninstall);

    const uninstalls = piUninstallCalls();
    expect(uninstalls).toHaveLength(1);
    expect(uninstalls[0]).not.toContain('@gotgenes/pi-subagents');
  });
});

describe('marketplace-backed platform handlers', () => {
  it('registers Claude Code and Codex CLI with their published packages', () => {
    const claudeCode = getPlatform('claude-code');
    const codex = getPlatform('codex');

    expect(claudeCode?.npmPackage).toBe('@maestria/claude-code');
    expect(codex?.npmPackage).toBe('@maestria/codex');
    expect(claudeCode?.supportsVersionPinning).toBe(false);
    expect(codex?.supportsVersionPinning).toBe(false);
  });

  it('recognizes the installed Claude Code plugin from host JSON', async () => {
    vi.mocked(shell.run).mockImplementation((cmd, args) => {
      if (cmd === 'claude' && args.join(' ') === 'plugin list --json') {
        return Effect.succeed(
          JSON.stringify([
            {
              id: 'maestria@maestria',
              name: 'maestria',
              version: '0.2.1',
            },
          ]),
        );
      }
      return Effect.succeed('');
    });

    const claudeCode = getPlatform('claude-code');
    expect(claudeCode).toBeDefined();
    expect(await Effect.runPromise(claudeCode!.isInstalled)).toBe(true);
    expect(await Effect.runPromise(claudeCode!.getInstalledVersion)).toBe('0.2.1');
  });

  it('recognizes the installed Codex CLI plugin from host JSON', async () => {
    vi.mocked(shell.run).mockImplementation((cmd, args) => {
      if (cmd === 'codex' && args.join(' ') === 'plugin list --json') {
        return Effect.succeed(
          JSON.stringify({
            installed: [
              {
                pluginId: 'maestria@maestria',
                name: 'maestria',
                marketplaceName: 'maestria',
                version: '0.2.0',
              },
            ],
          }),
        );
      }
      return Effect.succeed('');
    });

    const codex = getPlatform('codex');
    expect(codex).toBeDefined();
    expect(await Effect.runPromise(codex!.isInstalled)).toBe(true);
    expect(await Effect.runPromise(codex!.getInstalledVersion)).toBe('0.2.0');
  });

  it('uses host-native uninstall commands', async () => {
    vi.clearAllMocks();

    await Effect.runPromise(getPlatform('claude-code')!.uninstall);
    await Effect.runPromise(getPlatform('codex')!.uninstall);

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

    const cursor = getPlatform('cursor');
    expect(cursor).toBeDefined();
    expect(await Effect.runPromise(cursor!.detect)).toBe(true);
  });

  it('does not treat an unrelated agent binary as Cursor', async () => {
    vi.mocked(shell.commandExists).mockImplementation((cmd) => Effect.succeed(cmd === 'agent'));
    vi.mocked(shell.run).mockImplementation((cmd, args) => {
      if (cmd === 'which' && args[0] === 'agent') return Effect.succeed('/usr/local/bin/agent');
      if (cmd === 'agent' && args[0] === '--version') return Effect.succeed('Grok Build TUI 1.0.0');
      return Effect.succeed('');
    });

    const cursor = getPlatform('cursor');
    expect(cursor).toBeDefined();
    expect(await Effect.runPromise(cursor!.detect)).toBe(false);
  });
});

describe('Kimi Code platform registration', () => {
  it('recognizes the native installed.json registry instead of a global AGENTS.md marker', async () => {
    const previousHome = process.env.KIMI_CODE_HOME;
    process.env.KIMI_CODE_HOME = '/tmp/maestria-kimi-test';
    fsMocks.readFile.mockImplementation(async (filePath: string) => {
      if (filePath.endsWith('/plugins/installed.json')) {
        return JSON.stringify({
          version: 1,
          plugins: [
            {
              id: 'maestria',
              root: '/tmp/maestria-kimi-test/plugins/managed/maestria',
              source: 'local-path',
              enabled: true,
              installedAt: '2026-08-26T00:00:00.000Z',
            },
          ],
        });
      }
      return JSON.stringify({ version: '0.2.0' });
    });

    try {
      const kimi = getPlatform('kimi-code');
      expect(kimi).toBeDefined();
      expect(await Effect.runPromise(kimi!.isInstalled)).toBe(true);
    } finally {
      if (previousHome === undefined) delete process.env.KIMI_CODE_HOME;
      else process.env.KIMI_CODE_HOME = previousHome;
    }
  });
});

// `prime-agent package list` prints configured package sources from settings
// grouped by scope: a "User packages:" section and a "Project packages:"
// section. The handler parses only the user (global) section - the scope its
// install/update/remove commands target - and reads the installed version from
// the path line printed directly below each source line. Version reads go
// through Node's cross-platform fs/promises API (readPackageJsonVersion), so
// these tests stub that read rather than a POSIX `cat`; the helper itself is
// exercised against the real filesystem in its own test below.
describe('prime-agent platform handler', () => {
  it('registers Prime Agent with the @maestria/prime-agent package, no version pinning, and an update preflight', () => {
    const prime = getPlatform('prime-agent');
    expect(prime).toBeDefined();
    expect(prime?.npmPackage).toBe('@maestria/prime-agent');
    expect(prime?.supportsVersionPinning).toBe(false);
    // The preflight lets the update command block a version-pinned registration
    // even before the "Already up to date" short-circuit.
    expect(prime?.preflightUpdate).toBeDefined();
  });

  it('recognizes the installed package from `package list` and reads its version from the reported path', async () => {
    vi.mocked(shell.run).mockImplementation((cmd, args) => {
      if (cmd === 'prime-agent' && args.join(' ') === 'package list') {
        return Effect.succeed(
          [
            'User packages:',
            '  npm:@maestria/prime-agent',
            '    /home/user/.npm-global/lib/node_modules/@maestria/prime-agent',
          ].join('\n'),
        );
      }
      return Effect.succeed('');
    });
    fsMocks.readFile.mockResolvedValue(
      JSON.stringify({ name: '@maestria/prime-agent', version: '0.2.0' }),
    );

    const prime = getPlatform('prime-agent');
    expect(prime).toBeDefined();
    expect(await Effect.runPromise(prime!.isInstalled)).toBe(true);
    expect(await Effect.runPromise(prime!.getInstalledVersion)).toBe('0.2.0');
    // The version is read via Node fs from the path Prime reports, not via a
    // POSIX shell command.
    expect(fsMocks.readFile).toHaveBeenCalledWith(
      '/home/user/.npm-global/lib/node_modules/@maestria/prime-agent/package.json',
      'utf-8',
    );
  });

  it('still recognizes the package when its entry is filtered', async () => {
    vi.mocked(shell.run).mockImplementation((cmd, args) => {
      if (cmd === 'prime-agent' && args.join(' ') === 'package list') {
        return Effect.succeed(
          ['User packages:', '  npm:@maestria/prime-agent (filtered)'].join('\n'),
        );
      }
      return Effect.succeed('');
    });

    expect(await Effect.runPromise(getPlatform('prime-agent')!.isInstalled)).toBe(true);
  });

  it('reports not installed when the package is absent from `package list`', async () => {
    vi.mocked(shell.run).mockImplementation((cmd, args) => {
      if (cmd === 'prime-agent' && args.join(' ') === 'package list') {
        return Effect.succeed('No packages installed.');
      }
      return Effect.succeed('');
    });

    const prime = getPlatform('prime-agent');
    expect(await Effect.runPromise(prime!.isInstalled)).toBe(false);
    expect(await Effect.runPromise(prime!.getInstalledVersion)).toBe('unknown');
  });

  it('does not count a project-only registration as installed (global scope is managed)', async () => {
    vi.mocked(shell.run).mockImplementation((cmd, args) => {
      if (cmd === 'prime-agent' && args.join(' ') === 'package list') {
        return Effect.succeed(
          [
            'Project packages:',
            '  npm:@maestria/prime-agent',
            '    /project/.prime/agent/npm/node_modules/@maestria/prime-agent',
          ].join('\n'),
        );
      }
      return Effect.succeed('');
    });

    const prime = getPlatform('prime-agent');
    expect(await Effect.runPromise(prime!.isInstalled)).toBe(false);
    expect(await Effect.runPromise(prime!.getInstalledVersion)).toBe('unknown');
  });

  it('recognizes a versioned npm source and reads the version from its own path', async () => {
    vi.mocked(shell.run).mockImplementation((cmd, args) => {
      if (cmd === 'prime-agent' && args.join(' ') === 'package list') {
        return Effect.succeed(
          [
            'User packages:',
            '  npm:@maestria/prime-agent@0.2.0',
            '    /home/user/.npm-global/lib/node_modules/@maestria/prime-agent',
          ].join('\n'),
        );
      }
      return Effect.succeed('');
    });
    fsMocks.readFile.mockResolvedValue(
      JSON.stringify({ name: '@maestria/prime-agent', version: '0.2.0' }),
    );

    const prime = getPlatform('prime-agent');
    expect(await Effect.runPromise(prime!.isInstalled)).toBe(true);
    expect(await Effect.runPromise(prime!.getInstalledVersion)).toBe('0.2.0');
  });

  it('binds the version lookup to the current entry, not the next absolute path', async () => {
    vi.mocked(shell.run).mockImplementation((cmd, args) => {
      if (cmd === 'prime-agent' && args.join(' ') === 'package list') {
        // The maestria entry has no installed path; the following entry does.
        // Its absolute path must not be attributed to maestria.
        return Effect.succeed(
          [
            'User packages:',
            '  npm:@maestria/prime-agent',
            '  npm:@other/plugin',
            '    /home/user/.npm-global/lib/node_modules/@other/plugin',
          ].join('\n'),
        );
      }
      return Effect.succeed('');
    });

    const prime = getPlatform('prime-agent');
    expect(await Effect.runPromise(prime!.isInstalled)).toBe(true);
    expect(await Effect.runPromise(prime!.getInstalledVersion)).toBe('unknown');
    const readPaths = fsMocks.readFile.mock.calls.map(([path]) => path);
    expect(readPaths).not.toContain(
      '/home/user/.npm-global/lib/node_modules/@other/plugin/package.json',
    );
  });

  it('reads the version from the maestria entry even when a sibling entry precedes it', async () => {
    vi.mocked(shell.run).mockImplementation((cmd, args) => {
      if (cmd === 'prime-agent' && args.join(' ') === 'package list') {
        return Effect.succeed(
          [
            'User packages:',
            '  npm:@other/plugin',
            '    /home/user/.npm-global/lib/node_modules/@other/plugin',
            '  npm:@maestria/prime-agent',
            '    /home/user/.npm-global/lib/node_modules/@maestria/prime-agent',
          ].join('\n'),
        );
      }
      return Effect.succeed('');
    });
    fsMocks.readFile.mockImplementation(async (path: string) =>
      JSON.stringify(
        path.includes('@other/plugin')
          ? { name: '@other/plugin', version: '9.9.9' }
          : { name: '@maestria/prime-agent', version: '0.2.0' },
      ),
    );

    const prime = getPlatform('prime-agent');
    expect(await Effect.runPromise(prime!.isInstalled)).toBe(true);
    expect(await Effect.runPromise(prime!.getInstalledVersion)).toBe('0.2.0');
  });

  it('does not run `package update` for a version-pinned registration and reports why', async () => {
    vi.clearAllMocks();
    vi.mocked(shell.run).mockImplementation((cmd, args) => {
      if (cmd === 'prime-agent' && args.join(' ') === 'package list') {
        return Effect.succeed(
          [
            'User packages:',
            '  npm:@maestria/prime-agent@0.2.0',
            '    /home/user/.npm-global/lib/node_modules/@maestria/prime-agent',
          ].join('\n'),
        );
      }
      return Effect.succeed('');
    });

    const prime = getPlatform('prime-agent');
    const message = await Effect.runPromise(
      prime!
        .update()
        .pipe(Effect.catchTag('CommandError', (error) => Effect.succeed(error.message))),
    );

    // Prime skips `package update` for pinned registrations, so the update must
    // fail with an accurate message instead of claiming success.
    expect(message).toContain('version-pinned');
    expect(message).toContain('npm:@maestria/prime-agent@0.2.0');

    // The update command itself must not be issued (and the version cache must
    // not be invalidated as a side effect of a fake success).
    const updateCalls = vi
      .mocked(shell.run)
      .mock.calls.filter(
        (call) =>
          call[0] === 'prime-agent' && call[1]?.[0] === 'package' && call[1]?.[1] === 'update',
      );
    expect(updateCalls).toHaveLength(0);
  });

  it('routes a Windows-style absolute installed path to the cross-platform fs read', async () => {
    vi.clearAllMocks();
    vi.mocked(shell.run).mockImplementation((cmd, args) => {
      if (cmd === 'prime-agent' && args.join(' ') === 'package list') {
        return Effect.succeed(
          [
            'User packages:',
            '  npm:@maestria/prime-agent',
            '    C:\\Users\\user\\AppData\\Roaming\\npm\\node_modules\\@maestria\\prime-agent',
          ].join('\n'),
        );
      }
      return Effect.succeed('');
    });
    fsMocks.readFile.mockResolvedValue(
      JSON.stringify({ name: '@maestria/prime-agent', version: '0.2.0' }),
    );

    const prime = getPlatform('prime-agent');
    expect(await Effect.runPromise(prime!.isInstalled)).toBe(true);
    expect(await Effect.runPromise(prime!.getInstalledVersion)).toBe('0.2.0');

    // The Windows-style path is handed to the Node fs read (with the
    // `/package.json` suffix appended) rather than to a POSIX `cat`/`ls`, so
    // the same code path works on a Windows host without shell translation.
    expect(fsMocks.readFile).toHaveBeenCalledWith(
      'C:\\Users\\user\\AppData\\Roaming\\npm\\node_modules\\@maestria\\prime-agent/package.json',
      'utf-8',
    );
    const posixShellCalls = vi
      .mocked(shell.run)
      .mock.calls.filter((call) => call[0] === 'cat' || call[0] === 'ls');
    expect(posixShellCalls).toHaveLength(0);
  });

  it('reads package versions through the real filesystem via Node fs (no POSIX shell)', async () => {
    const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');

    const dir = await mkdtemp(join(tmpdir(), 'maestria-prime-test-'));
    const packageJsonPath = join(dir, 'package.json');
    const originalReadFile = fsMocks.getOriginalReadFile();
    try {
      await writeFile(
        packageJsonPath,
        JSON.stringify({ name: '@maestria/prime-agent', version: '1.2.3' }),
        'utf-8',
      );
      // Delegate the stubbed readFile to the real implementation for this test
      // so the helper is proven against the actual filesystem.
      fsMocks.readFile.mockImplementation((path: string) =>
        originalReadFile
          ? originalReadFile(path, 'utf-8')
          : Promise.reject(new Error('original readFile unavailable')),
      );
      expect(await Effect.runPromise(readPackageJsonVersion(packageJsonPath))).toBe('1.2.3');
    } finally {
      fsMocks.readFile.mockResolvedValue(JSON.stringify({ version: '0.2.0' }));
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('uses the documented Prime package commands with the npm: source reference', async () => {
    vi.clearAllMocks();
    vi.mocked(shell.run).mockImplementation((_cmd, _args) => Effect.succeed(''));

    await Effect.runPromise(getPlatform('prime-agent')!.install);
    await Effect.runPromise(getPlatform('prime-agent')!.update());
    await Effect.runPromise(getPlatform('prime-agent')!.uninstall);

    const calls = vi
      .mocked(shell.run)
      .mock.calls.filter((call) => call[0] === 'prime-agent')
      .map(([, args]) => args);

    expect(calls).toContainEqual(['package', 'install', 'npm:@maestria/prime-agent']);
    expect(calls).toContainEqual(['package', 'update', 'npm:@maestria/prime-agent']);
    expect(calls).toContainEqual(['package', 'remove', 'npm:@maestria/prime-agent']);
  });

  it('keeps install/remove global: exact native args without --local', async () => {
    vi.clearAllMocks();
    vi.mocked(shell.run).mockImplementation((_cmd, _args) => Effect.succeed(''));

    await Effect.runPromise(getPlatform('prime-agent')!.install);
    await Effect.runPromise(getPlatform('prime-agent')!.uninstall);

    const calls = vi
      .mocked(shell.run)
      .mock.calls.filter((call) => call[0] === 'prime-agent')
      .map((call) => call[1]);

    // Without --local, `package install`/`remove` write to the default global
    // (user) settings; the CLI must never flip them to project scope.
    expect(calls).toEqual([
      ['package', 'install', 'npm:@maestria/prime-agent'],
      ['package', 'remove', 'npm:@maestria/prime-agent'],
    ]);
    expect(calls.flat().includes('--local')).toBe(false);
  });

  it('runs Prime package commands from an isolated temp cwd and removes it on success', async () => {
    vi.clearAllMocks();
    vi.mocked(shell.run).mockImplementation((_cmd, _args) => Effect.succeed(''));
    fsMocks.mkdtemp.mockResolvedValueOnce('/tmp/maestria-prime-test-abc123');

    await Effect.runPromise(getPlatform('prime-agent')!.install);

    // The install command was spawned with the isolated temp cwd, and the temp
    // cwd was removed afterwards.
    const installCalls = vi
      .mocked(shell.run)
      .mock.calls.filter((call) => call[0] === 'prime-agent' && call[1]?.[1] === 'install');
    expect(installCalls).toHaveLength(1);
    expect(installCalls[0][3]).toBe('/tmp/maestria-prime-test-abc123');
    expect(fsMocks.rm).toHaveBeenCalledWith('/tmp/maestria-prime-test-abc123', {
      recursive: true,
      force: true,
    });
  });

  it('removes the isolated temp cwd even when the Prime command fails', async () => {
    vi.clearAllMocks();
    vi.mocked(shell.run).mockImplementation((cmd, args) => {
      if (cmd === 'prime-agent' && args.join(' ') === 'package list') {
        return Effect.succeed(
          [
            'User packages:',
            '  npm:@maestria/prime-agent@0.2.0',
            '    /home/user/.npm-global/lib/node_modules/@maestria/prime-agent',
          ].join('\n'),
        );
      }
      return Effect.succeed('');
    });
    fsMocks.mkdtemp.mockResolvedValueOnce('/tmp/maestria-prime-test-def456');

    // A direct update() on a version-pinned registration fails with a
    // CommandError (Prime skips updates for pinned registrations) - but the
    // temp cwd created for the registration check must still be cleaned up.
    const message = await Effect.runPromise(
      getPlatform('prime-agent')!
        .update()
        .pipe(Effect.catchTag('CommandError', (error) => Effect.succeed(error.message))),
    );
    expect(message).toContain('version-pinned');
    expect(fsMocks.rm).toHaveBeenCalledWith('/tmp/maestria-prime-test-def456', {
      recursive: true,
      force: true,
    });
  });

  it('fails closed when the isolated temp cwd cannot be created', async () => {
    vi.clearAllMocks();
    vi.mocked(shell.run).mockImplementation((_cmd, _args) => Effect.succeed(''));
    fsMocks.mkdtemp.mockRejectedValueOnce(new Error('ENOSPC'));

    const message = await Effect.runPromise(
      getPlatform('prime-agent')!.install.pipe(
        Effect.catchTag('CommandError', (error) => Effect.succeed(error.message)),
      ),
    );

    // No Prime command may run (nothing was spawned) and nothing can be
    // cleaned up (no directory was created).
    expect(message).toContain('Failed to create an isolated working directory');
    const primeCalls = vi.mocked(shell.run).mock.calls.filter((call) => call[0] === 'prime-agent');
    expect(primeCalls).toHaveLength(0);
    expect(fsMocks.rm).not.toHaveBeenCalled();
  });
});
