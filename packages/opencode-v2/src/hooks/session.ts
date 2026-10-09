import { Effect } from 'effect';
import type { Scope } from 'effect';
import { getModeMarker, MODE_KEYWORDS, stripKeyword } from '@maestria/shared-mode';
import type { PluginContext, SessionPrompt } from '@/types.js';
import type { MaestriaPluginOptions } from '@/modes.js';
import { detectMode } from '@/modes.js';
import { readSyncedMarkdown } from '@/markdown.js';
import { RULES_PATH } from '@/root.js';

export const registerSessionHooks = (
  ctx: PluginContext,
  options: MaestriaPluginOptions,
): Effect.Effect<void, never, Scope.Scope> =>
  Effect.gen(function* registerSessionHook() {
    const disabledKeywords = new Set(options.modes?.disabledKeywords);
    const rules = readSyncedMarkdown(RULES_PATH, 'global rules');

    yield* ctx.session.hook('prompt', (event: SessionPrompt) =>
      Effect.sync(() => {
        const { text } = event.prompt;
        // Slash commands already carry their explicit mode; do not detect keywords in their templates.
        if (MODE_KEYWORDS.some((mode) => text.startsWith(getModeMarker(mode)))) {
          return;
        }
        const result = detectMode(text, disabledKeywords);
        if (!result) {
          return;
        }
        event.prompt.text = `${result.marker}\n\n${result.prompt}\n\n${stripKeyword(text, result)}`;
        // Expansion shifts every mention. URI/name/id still resolves each attachment normally.
        for (const part of [
          ...(event.prompt.files ?? []),
          ...(event.prompt.agents ?? []),
          ...(event.prompt.skills ?? []),
        ]) {
          delete part.mention;
        }
      }),
    );
    yield* ctx.session.hook('context', (event) =>
      Effect.sync(() => {
        if (rules !== null) {
          event.system.push({ text: rules, type: 'text' });
        }
      }),
    );
  });
