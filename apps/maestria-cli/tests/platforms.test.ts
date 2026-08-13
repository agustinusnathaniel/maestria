import { describe, it, expect, vi } from 'vite-plus/test';
import { Effect } from 'effect';

vi.mock('@/lib/shell.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/shell.js')>();
  return {
    ...actual,
    // Return a real Effect so module-evaluation .pipe() chains in platforms.ts
    // keep working; executing it resolves without spawning any subprocess.
    run: vi.fn((_cmd: string, _args: string[], _timeoutMs?: number) => Effect.succeed('')),
    sh: vi.fn((_command: string, _timeoutMs?: number) => Effect.succeed('')),
  };
});

import * as shell from '@/lib/shell.js';
import { getPlatform } from '@/lib/platforms.js';

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
    const codexCli = getPlatform('codex-cli');

    expect(claudeCode?.npmPackage).toBe('@maestria/claude-code');
    expect(codexCli?.npmPackage).toBe('@maestria/codex');
    expect(claudeCode?.supportsVersionPinning).toBe(false);
    expect(codexCli?.supportsVersionPinning).toBe(false);
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

    const codexCli = getPlatform('codex-cli');
    expect(codexCli).toBeDefined();
    expect(await Effect.runPromise(codexCli!.isInstalled)).toBe(true);
    expect(await Effect.runPromise(codexCli!.getInstalledVersion)).toBe('0.2.0');
  });

  it('uses host-native uninstall commands', async () => {
    vi.clearAllMocks();

    await Effect.runPromise(getPlatform('claude-code')!.uninstall);
    await Effect.runPromise(getPlatform('codex-cli')!.uninstall);

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
    ]);
    expect(calls).toContainEqual(['codex', 'plugin', 'remove', 'maestria@maestria', '--json']);
  });
});
