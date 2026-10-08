import { Effect } from 'effect';
import type { Scope } from 'effect';
import type { PluginContext, SessionContext } from '@/types.js';
import type { MaestriaPluginOptions } from '@/modes.js';
import { detectMode } from '@/modes.js';

// Mode handling stays on the `context` hook: it runs before every model
// dispatch (including tool-driven continuations), so the mode marker persists
// for the whole agent loop. The `prompt` hook only runs once at admission;
// keyword stripping lives here alongside detection so both stay in one place.
export const registerSessionHooks = (
  ctx: PluginContext,
  options: MaestriaPluginOptions,
): Effect.Effect<void, never, Scope.Scope> =>
  Effect.gen(function* registerSessionHook() {
    const disabledKeywords = new Set(options.modes?.disabledKeywords);

    yield* ctx.session.hook('context', (sessionCtx: SessionContext) =>
      Effect.sync(() => {
        const lastUserMsg = sessionCtx.messages.toReversed().find((m) => m.role === 'user');
        if (!lastUserMsg) {
          return;
        }

        const textParts = lastUserMsg.content.filter((p) => p.type === 'text') as {
          type: 'text';
          text: string;
        }[];
        if (textParts.length === 0) {
          return;
        }

        const joined = textParts.map((p) => p.text).join('\n');
        const result = detectMode(joined, disabledKeywords);
        if (!result) {
          return;
        }

        const modeBlock = [result.marker, '', result.prompt].join('\n');
        sessionCtx.system.push({ text: modeBlock, type: 'text' });

        // Parts were joined with '\n' for detection, so the keyword sits in
        // the part spanning result.index (first iteration for single-part).
        let offset = 0;
        for (const part of textParts) {
          const at = result.index - offset;
          if (at >= 0 && at <= part.text.length) {
            part.text = (part.text.slice(0, at) + part.text.slice(at + result.keyword.length))
              .replace(/:?\s*$/u, '')
              .trim();
            break;
          }
          offset += part.text.length + 1;
        }
      }),
    );
  });
