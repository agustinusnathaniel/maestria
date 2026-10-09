import { Effect } from 'effect';
import { describe, expect, it } from 'vite-plus/test';
import plugin from '../src/index.js';
import type { PluginContext } from '../src/types.js';

// Shared SDK Transform stub return: a no-op registration handle.
const registered = Effect.succeed({ dispose: Effect.void });

const makeStubCtx = (options: unknown): PluginContext =>
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- fake implements only the host registration seam; real registration is exercised by the E2E probe.
  ({
    agent: { transform: () => registered },
    command: { transform: () => registered },
    location: { directory: process.cwd(), project: { directory: process.cwd() } },
    options,
    session: { hook: () => registered, prompt: () => Effect.void },
    skill: { transform: () => registered },
  }) as unknown as PluginContext;

describe('maestria-v2 plugin', () => {
  it('should define a plugin with id maestria.v2', () => {
    expect(plugin).toBeDefined();
    expect(plugin.id).toBe('maestria.v2');
  });

  it('warns and falls back to defaults on invalid options', async () => {
    const warns: unknown[][] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warns.push(args);
    };
    try {
      const ctx = makeStubCtx({ modes: { disabledKeywords: ['nope'] } });
      await Effect.runPromise(Effect.scoped(plugin.effect(ctx)));
    } finally {
      console.warn = originalWarn;
    }
    expect(warns.some((args) => String(args[0]).includes('Ignoring invalid plugin options'))).toBe(
      true,
    );
  });
});
