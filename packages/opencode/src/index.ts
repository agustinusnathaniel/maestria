import path from 'node:path';
import { Effect, Option, Schema } from 'effect';
import { Plugin } from '@opencode/plugin/effect';
import { MODE_KEYWORDS } from '@maestria/shared-mode';
import { loadBundle } from '@/bundle.js';
import { registerSessionHooks, withMode } from '@/session.js';

const Options = Schema.Struct({
  modes: Schema.optional(
    Schema.Struct({
      disabledKeywords: Schema.optional(Schema.Array(Schema.Literals(MODE_KEYWORDS))),
    }),
  ),
});

// Command executors resubmit prompts with a mode prefix, so the original mention offsets no longer match.
const withoutMention = <Part extends { mention?: unknown }>({ mention: _mention, ...part }: Part) =>
  part;

export default Plugin.define({
  effect: (ctx) =>
    Effect.gen(function* initMaestria() {
      const options = Schema.decodeUnknownOption(Options)(ctx.options);
      if (Option.isNone(options)) {
        yield* Effect.logWarning(
          '[maestria] Ignoring invalid options; expected { modes?: { disabledKeywords?: ("fein" | "sonar" | "blitz")[] } }',
        );
      }
      const disabledKeywords = new Set(Option.getOrUndefined(options)?.modes?.disabledKeywords);
      const bundle = loadBundle(path.join(import.meta.dirname, '..'));

      yield* ctx.agent.transform((editor) => {
        for (const [name, agent] of bundle.agents) {
          editor.update(name, (draft) => {
            draft.description = agent.description;
            draft.mode = agent.mode;
            draft.permissions = agent.permissions.map((rule) => ({ ...rule }));
            draft.system = agent.system;
          });
        }
      });

      yield* ctx.command.transform((editor) => {
        for (const name of MODE_KEYWORDS) {
          editor.add({
            description: bundle.modes[name].description,
            execute: ({ delivery, prompt, sessionID }) =>
              ctx.session
                .prompt({
                  agents: prompt.agents?.map(withoutMention),
                  delivery,
                  files: prompt.files?.map(withoutMention),
                  sessionID,
                  skills: prompt.skills?.map(withoutMention),
                  text: withMode(bundle, name, prompt.text),
                })
                .pipe(Effect.asVoid),
            name,
          });
        }
      });

      // Project and user skills with the same ID still take precedence in the host.
      yield* ctx.skill.transform((editor) => {
        for (const skill of bundle.skills) {
          editor.add(skill);
        }
      });

      yield* registerSessionHooks(ctx, bundle, disabledKeywords);
    }),
  id: 'maestria.v2',
});
