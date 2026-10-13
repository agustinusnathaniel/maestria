import { Effect } from 'effect';
import type { Scope } from 'effect';
import type { Plugin } from '@opencode/plugin/effect';
import { detectMode, MODE_MARKERS, stripKeyword } from '@maestria/shared-mode';
import type { ModeKeyword } from '@maestria/shared-mode';
import { formatProjectSection, loadProjectSections } from '@maestria/shared-project-config';
import type { Bundle } from '@/bundle.js';

export const withMode = (bundle: Bundle, mode: ModeKeyword, text: string): string =>
  `${bundle.modes[mode].template}\n\n${text}`;

export const registerSessionHooks = (
  ctx: Pick<Plugin.Context, 'location' | 'session'>,
  bundle: Bundle,
  disabledKeywords: Set<string>,
): Effect.Effect<void, never, Scope.Scope> =>
  Effect.gen(function* registerSessionHooksEffect() {
    const { location } = ctx;
    // The global project reports `/`; project files then live in the session directory.
    const projectRoot =
      location.project.directory === '/' ? location.directory : location.project.directory;

    yield* ctx.session.hook('prompt', (event) =>
      Effect.sync(() => {
        const { text } = event.prompt;
        // Slash commands submit an already expanded mode whose template names its keyword.
        if (Object.values(MODE_MARKERS).some((marker) => text.startsWith(marker))) {
          return;
        }
        const detected = detectMode(text, disabledKeywords);
        if (detected === null) {
          return;
        }
        event.prompt.text = withMode(bundle, detected.mode, stripKeyword(text, detected));
        // Desktop and web history render this presentation text instead of the prompt.
        if (typeof event.metadata?.displayText === 'string') {
          event.metadata.displayText = event.prompt.text;
        }
        // Expansion moves every mention; attachments still resolve by URI, name, or ID.
        for (const part of [
          ...(event.prompt.files ?? []),
          ...(event.prompt.agents ?? []),
          ...(event.prompt.skills ?? []),
        ]) {
          delete part.mention;
        }
      }),
    );

    for (const name of ['context', 'compaction'] as const) {
      yield* ctx.session.hook(name, (event) =>
        Effect.sync(() => {
          event.system.push({ text: bundle.rules, type: 'text' });
          // Read per request so edits apply without a reload; unusable files throw and block dispatch.
          const project = loadProjectSections(projectRoot).map(formatProjectSection);
          if (project.length > 0) {
            event.system.push({ text: project.join('\n\n'), type: 'text' });
          }
        }),
      );
    }
  });
