import { Effect } from 'effect';
import { describe, expect, it } from 'vite-plus/test';
import { registerSessionHooks } from '../src/hooks/session.js';
import type { PluginContext, SessionContext } from '../src/types.js';

const makeSessionCtx = (texts: string[]): SessionContext => {
  const messages = [{ content: texts.map((text) => ({ text, type: 'text' })), role: 'user' }];
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- test double supplies only the fields the hook reads (messages, system); full SDK branding is unnecessary here.
  return { messages, system: [] } as unknown as SessionContext;
};

const captureContextHook = async (): Promise<
  (sessionCtx: SessionContext) => Effect.Effect<void>
> => {
  let captured: ((sessionCtx: SessionContext) => Effect.Effect<void>) | undefined;
  await Effect.runPromise(
    Effect.scoped(
      registerSessionHooks(
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- test double implements only session.hook; the remaining plugin domains are untouched by this hook.
        {
          session: {
            // oxlint-disable-next-line promise/prefer-await-to-callbacks -- test double must implement the SDK Hooks callback signature; an async function would not satisfy it.
            hook: (name: string, callback: (sessionCtx: SessionContext) => Effect.Effect<void>) => {
              expect(name).toBe('context');
              captured = callback;
              return Effect.succeed({
                dispose: Effect.void,
              });
            },
          },
        } as unknown as PluginContext,
        {},
      ),
    ),
  );
  if (!captured) {
    throw new Error('expected the context hook to be registered');
  }
  return captured;
};

const CASES = [
  {
    expectedParts: ['plan the work'],
    expectedSystem: 1,
    name: 'pushes the mode block to system and strips a single-part keyword',
    texts: ['fein plan the work'],
  },
  {
    expectedParts: ['hello', 'do X'],
    expectedSystem: 1,
    name: 'strips the keyword from the containing part of a multipart message',
    texts: ['hello', 'fein do X'],
  },
  {
    expectedParts: ['plain hello'],
    expectedSystem: 0,
    name: 'leaves messages without a keyword untouched',
    texts: ['plain hello'],
  },
];

describe('registerSessionHooks keyword strip', () => {
  for (const { expectedParts, expectedSystem, name, texts } of CASES) {
    it(name, async () => {
      const hook = await captureContextHook();
      const sessionCtx = makeSessionCtx(texts);

      await Effect.runPromise(hook(sessionCtx));

      expect(sessionCtx.system).toHaveLength(expectedSystem);
      if (expectedSystem > 0) {
        const systemText =
          sessionCtx.system[0].type === 'text' ? sessionCtx.system[0].text : undefined;
        expect(systemText).toContain('## MODE: fein');
      }
      const parts = sessionCtx.messages[0].content.filter((p) => p.type === 'text');
      expect(parts.map((p) => (p.type === 'text' ? p.text : ''))).toEqual(expectedParts);
    });
  }
});
