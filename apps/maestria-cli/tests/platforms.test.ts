import { describe, it, expect, vi } from 'vite-plus/test';
import { Effect } from 'effect';

vi.mock('@/lib/shell.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/shell.js')>();
  return {
    ...actual,
    // Return a real Effect so module-evaluation .pipe() chains in platforms.ts
    // keep working; executing it resolves without spawning any subprocess.
    run: vi.fn((_cmd: string, _args: string[], _timeoutMs?: number) => Effect.succeed('')),
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
