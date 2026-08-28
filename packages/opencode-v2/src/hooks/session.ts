import { Effect } from 'effect';
import type { SessionContext, PluginContext } from '@/types.js';
import type { MaestriaPluginOptions, ModeKeyword } from '@/modes/types.js';
import { detectMode } from '@/modes/index.js';
import { getModeMarker, getModePrompt } from '@/modes/prompts.js';

export function registerSessionHooks(
  ctx: PluginContext,
  options: MaestriaPluginOptions,
): Effect.Effect<void, never, import('effect').Scope.Scope> {
  return Effect.gen(function* () {
    const rawDisabled = (options.modes?.disabledKeywords ?? []) as ModeKeyword[] | undefined;
    const disabledKeywords = new Set<string>((rawDisabled ?? []).map((k) => k.toLowerCase()));

    yield* ctx.session.hook('context', (sessionCtx: SessionContext) =>
      Effect.sync(() => {
        const lastUserMsg = [...sessionCtx.messages].reverse().find((m) => m.role === 'user');
        if (!lastUserMsg) return;

        const textParts = lastUserMsg.content.filter((p) => p.type === 'text') as Array<{
          type: 'text';
          text: string;
        }>;
        if (textParts.length === 0) return;

        const joined = textParts.map((p) => p.text).join('\n');
        const result = detectMode(joined, disabledKeywords);
        if (!result) return;

        const modeBlock = [getModeMarker(result.mode), '', getModePrompt(result.mode)].join('\n');
        sessionCtx.system.push({ type: 'text', text: modeBlock });

        let offset = 0;
        for (const part of textParts) {
          const partEnd = offset + part.text.length + 1;
          if (result.index >= offset && result.index < partEnd) {
            const localIndex = result.index - offset;
            part.text = (
              part.text.slice(0, localIndex) + part.text.slice(localIndex + result.keyword.length)
            )
              .replace(/:?\s*$/, '')
              .trim();
            break;
          }
          offset = partEnd;
        }
      }),
    );
  });
}
