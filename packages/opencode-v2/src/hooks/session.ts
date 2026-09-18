import { Effect } from 'effect';
import type { Scope } from 'effect';
import type { PluginContext, SessionContext } from '@/types.js';
import type { MaestriaPluginOptions } from '@/modes.js';
import { detectMode } from '@/modes.js';

/**
 * Session hook registration.
 *
 * Ground truth: SessionDomain only exposes `context`, `http.request`, `http.response` hooks
 * (see @opencode-ai/plugin/effect/session - SessionHooks). There is NO `prompt` hook in the
 * current SDK (v2 beta `0.0.0-next-17444`). Mode handling must stay on `context` where
 * `SessionContext` exposes `messages: Message[]` and mutable `system: SystemPart[]`.
 * If a future SDK adds `prompt` or `message` hooks, re-evaluate splitting detection to that
 * earlier hook - but keep the `context` hook as the canonical injection point.
 * Compaction/generate/title hooks are absent from the pin by design (see README
 * Known limitations); markers intentionally cover `context` only.
 */
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

        // Parts were joined with '\n' for detection, so each part starts at
        // the running offset (plus one separator). Single-part messages hit
        // on the first iteration with localIndex === result.index.
        let offset = 0;
        for (const part of textParts) {
          const localIndex = result.index - offset;
          if (localIndex >= 0 && localIndex <= part.text.length) {
            part.text = (
              part.text.slice(0, localIndex) + part.text.slice(localIndex + result.keyword.length)
            )
              .replace(/:?\s*$/u, '')
              .trim();
            break;
          }
          offset += part.text.length + 1;
        }
      }),
    );
  });
