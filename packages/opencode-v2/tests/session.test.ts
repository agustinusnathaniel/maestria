import { Effect } from 'effect';
import { Skill } from '@opencode/plugin/effect';
import { describe, expect, it } from 'vite-plus/test';
import { registerSessionHooks } from '../src/hooks/session.js';
import type { PluginContext, SessionContext, SessionPrompt } from '../src/types.js';
import type { MaestriaPluginOptions } from '../src/modes.js';

const captureHooks = async (options: MaestriaPluginOptions = {}) => {
  let prompt: ((event: SessionPrompt) => Effect.Effect<void>) | undefined;
  let context: ((event: SessionContext) => Effect.Effect<void>) | undefined;
  await Effect.runPromise(
    Effect.scoped(
      registerSessionHooks(
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- fake implements only the host hook registration seam.
        {
          session: {
            // oxlint-disable-next-line promise/prefer-await-to-callbacks -- implements the SDK callback interface.
            hook: (name: string, callback: never) => {
              if (name === 'prompt') {
                prompt = callback;
              } else if (name === 'context') {
                context = callback;
              }
              return Effect.succeed({ dispose: Effect.void });
            },
          },
        } as unknown as PluginContext,
        options,
      ),
    ),
  );
  if (!prompt || !context) {
    throw new Error('expected prompt and context hooks');
  }
  return { context, prompt };
};

const admission = (text: string): SessionPrompt =>
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- only prompt and session identity are relevant to admission.
  ({ prompt: { text }, sessionID: 'session-test' }) as unknown as SessionPrompt;

describe('session admission', () => {
  it('expands every bare mode into durable instructions and strips its trigger', async () => {
    const { prompt } = await captureHooks();
    await Promise.all(
      ['fein', 'sonar', 'blitz'].map(async (mode) => {
        const event = admission(`${mode.toUpperCase()}: inspect the project`);
        await Effect.runPromise(prompt(event));
        expect(event.prompt.text.startsWith(`[MODE: ${mode}]`)).toBe(true);
        expect(event.prompt.text).toContain(`## MODE: ${mode}`);
        expect(event.prompt.text.endsWith('\n\ninspect the project')).toBe(true);
      }),
    );
  });

  it('replaces desktop display text alongside the prompt and preserves other metadata', async () => {
    const { prompt } = await captureHooks();
    const event = admission('test fein');
    const comments = [{ comment: 'Keep this note', path: 'README.md' }];
    event.metadata = { attachments: [], comments, displayText: 'test fein' };
    await Effect.runPromise(prompt(event));
    expect(event.metadata.displayText).toBe(event.prompt.text);
    expect(event.metadata.displayText).toContain('[MODE: fein]');
    expect(event.metadata.comments).toBe(comments);
    expect(event.metadata.attachments).toEqual([]);
  });

  it('does not carry a mode into a later plain turn in the same session', async () => {
    const { prompt } = await captureHooks();
    await Effect.runPromise(prompt(admission('fein inspect')));
    const next = admission('now explain the result');
    await Effect.runPromise(prompt(next));
    expect(next.prompt.text).toBe('now explain the result');
  });

  it('leaves code, disabled keywords, and empty prompts unchanged', async () => {
    const { prompt } = await captureHooks({ modes: { disabledKeywords: ['sonar'] } });
    await Promise.all(
      ['sonar inspect', '`fein`', '```\nblitz\n```', ''].map(async (text) => {
        const event = admission(text);
        await Effect.runPromise(prompt(event));
        expect(event.prompt.text).toBe(text);
      }),
    );
  });

  it('keeps an expanded slash command intact when it passes through admission', async () => {
    const { prompt } = await captureHooks();
    const event = admission('fein inspect');
    await Effect.runPromise(prompt(event));
    const expanded = event.prompt.text;
    await Effect.runPromise(prompt(event));
    expect(event.prompt.text).toBe(expanded);
  });

  it('preserves attachments while clearing ranges invalidated by instruction expansion', async () => {
    const { prompt } = await captureHooks();
    const event = admission('@builder fein inspect @file');
    event.prompt.files = [{ mention: { end: 27, start: 22, text: '@file' }, uri: 'file:///file' }];
    event.prompt.agents = [{ mention: { end: 8, start: 0, text: '@builder' }, name: 'builder' }];
    event.prompt.skills = [
      { id: Skill.ID.make('handoff'), mention: { end: 27, start: 22, text: '@file' } },
    ];
    await Effect.runPromise(prompt(event));
    expect(event.prompt.files).toEqual([{ uri: 'file:///file' }]);
    expect(event.prompt.agents).toEqual([{ name: 'builder' }]);
    expect(event.prompt.skills).toEqual([{ id: Skill.ID.make('handoff') }]);
  });
});

describe('session context', () => {
  it('adds bundled global rules to every model dispatch without rewriting history', async () => {
    const { context } = await captureHooks();
    const messages = [{ content: [{ text: 'plain hello', type: 'text' }], role: 'user' }];
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- fake includes only mutable dispatch fields used by the hook.
    const event = { messages, sessionID: 'session-test', system: [] } as unknown as SessionContext;
    await Effect.runPromise(context(event));
    const text = event.system.map((part) => (part.type === 'text' ? part.text : '')).join('\n');
    expect(text).toContain('Universal Floors');
    expect(messages[0].content[0].text).toBe('plain hello');
  });
});
