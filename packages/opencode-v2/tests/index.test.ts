import { Effect } from 'effect';
import { describe, expect, it } from 'vite-plus/test';
import plugin from '../src/index.js';
import type { PluginContext } from '../src/types.js';

// Shared SDK Transform stub return: a no-op registration handle.
const registered = Effect.succeed({ dispose: Effect.void });

// Minimal context double covering every domain the entrypoint registers.
// Only the transform/hook surface each registration touches is stubbed;
// the whole object is cast once, mirroring the per-domain test doubles.
const makeStubCtx = (options: unknown) => {
  const transformed: string[] = [];
  const hooked: string[] = [];
  const transformStub =
    (domain: string) =>
    // oxlint-disable-next-line promise/prefer-await-to-callbacks -- test double must implement the SDK Transform callback signature; an async function would not satisfy it.
    (callback: (editor: never) => void) => {
      void callback;
      transformed.push(domain);
      return registered;
    };
  return {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- test double implements only the surfaces the registrations touch.
    ctx: {
      agent: { transform: transformStub('agent') },
      command: { transform: transformStub('command') },
      options,
      reference: { transform: transformStub('reference') },
      session: {
        // oxlint-disable-next-line promise/prefer-await-to-callbacks -- test double must implement the SDK Hooks callback signature; an async function would not satisfy it.
        hook: (name: string, callback: (event: never) => Effect.Effect<void>) => {
          void callback;
          hooked.push(name);
          return registered;
        },
        prompt: () => Effect.void,
      },
      skill: { transform: transformStub('skill') },
    } as unknown as PluginContext,
    hooked,
    transformed,
  };
};

describe('maestria-v2 plugin', () => {
  it('should define a plugin with id maestria.v2', () => {
    expect(plugin).toBeDefined();
    expect(plugin.id).toBe('maestria.v2');
  });

  it('registers all five domains when the effect runs', async () => {
    const { ctx, hooked, transformed } = makeStubCtx({});
    await Effect.runPromise(Effect.scoped(plugin.effect(ctx)));
    expect(transformed.toSorted()).toEqual(['agent', 'command', 'reference', 'skill']);
    expect(hooked).toEqual(['context']);
  });

  it('warns and falls back to defaults on invalid options', async () => {
    const warns: unknown[][] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warns.push(args);
    };
    try {
      const { ctx, transformed } = makeStubCtx({ modes: { disabledKeywords: ['nope'] } });
      await Effect.runPromise(Effect.scoped(plugin.effect(ctx)));
      expect(transformed).toHaveLength(4);
    } finally {
      console.warn = originalWarn;
    }
    expect(warns.some((args) => String(args[0]).includes('Ignoring invalid plugin options'))).toBe(
      true,
    );
  });
});
