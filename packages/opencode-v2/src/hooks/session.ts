import { Effect } from 'effect';
import type { Scope } from 'effect';
import type { PluginContext, SessionContext } from '@/types.js';
import type { MaestriaPluginOptions } from '@/modes/types.js';
import { detectMode } from '@/modes/index.js';
import { getModeMarker, getModePrompt } from '@/modes/prompts.js';

/**
 * Session hook registration.
 *
 * Ground truth: SessionDomain only exposes `context`, `http.request`, `http.response` hooks
 * (see @opencode-ai/plugin/effect/session - SessionHooks). There is NO `prompt` hook in the
 * current SDK (v2 beta `0.0.0-next-17444`). Mode handling must stay on `context` where
 * `SessionContext` exposes `messages: Message[]` and mutable `system: SystemPart[]`.
 * If a future SDK adds `prompt` or `message` hooks, re-evaluate splitting detection to that
 * earlier hook - but keep the `context` hook as the canonical injection point.
 *
 * Compaction note: live docs (/migrate-v1) name `ctx.session.hook("compaction", ...)` as the
 * V2 destination for V1 `experimental.session.compacting`, but the pinned package does not
 * expose it, so mode markers intentionally do not cover compaction/generate/title requests.
 * Re-evaluate when the pin moves to a track that ships those hooks.
 */
export const registerSessionHooks = (
  ctx: PluginContext,
  options: MaestriaPluginOptions,
): Effect.Effect<void, never, Scope.Scope> =>
  Effect.gen(function* registerSessionHook() {
    const disabled = options.modes?.disabledKeywords ?? [];
    const disabledKeywords = new Set(disabled.map((k) => k.toLowerCase()));

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

        const modeBlock = [getModeMarker(result.mode), '', getModePrompt(result.mode)].join('\n');
        sessionCtx.system.push({ text: modeBlock, type: 'text' });

        let offset = 0;
        for (const part of textParts) {
          const partEnd = offset + part.text.length + 1;
          if (result.index >= offset && result.index < partEnd) {
            const localIndex = result.index - offset;
            part.text = (
              part.text.slice(0, localIndex) + part.text.slice(localIndex + result.keyword.length)
            )
              .replace(/:?\s*$/u, '')
              .trim();
            break;
          }
          offset = partEnd;
        }
      }),
    );
  });
