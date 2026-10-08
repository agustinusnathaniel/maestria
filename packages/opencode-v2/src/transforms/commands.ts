import path from 'node:path';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import { MODE_KEYWORDS } from '@maestria/shared-mode';
import type { ModeKeyword } from '@maestria/shared-mode';
import type { CommandEditor, PluginContext, Transform } from '@/types.js';
import { readSyncedMarkdown } from '@/markdown.js';
import { COMMANDS_DIR } from '@/root.js';

// Descriptions mirror the canonical frontmatter at
// `packages/core/agent-directives/commands/*.md` (sync strips frontmatter,
// so the runtime copy keeps this map).
const COMMAND_DESCRIPTIONS: Record<ModeKeyword, string> = {
  blitz: 'Fast capability-aware route - skip optional recon and design ceremony',
  fein: 'Full pipeline - recon, design, implement, review',
  sonar: 'Research only - read-only recon and planning, stop before implementation',
};

// Workflow mode commands via `command.transform`. The V2 command API is
// add-only code-style commands (`add({ name, description, execute })`), so
// each mode prepends its synced template to the invocation text and submits
// it as a session prompt, preserving attachments and the delivery mode.
export const registerCommandTransforms = (ctx: {
  command: { transform: Transform<CommandEditor> };
  session: { prompt: PluginContext['session']['prompt'] };
}): Effect.Effect<void, never, Scope.Scope> =>
  Effect.gen(function* registerCommandTransformsEffect() {
    const templates = new Map<ModeKeyword, string>();
    for (const name of MODE_KEYWORDS) {
      // readSyncedMarkdown warns and returns null when the synced template
      // is missing; modes without a template are skipped.
      const template = readSyncedMarkdown(path.join(COMMANDS_DIR, `${name}.md`), 'command');
      if (template !== null) {
        templates.set(name, template);
      }
    }
    if (templates.size === 0) {
      console.warn(
        `[maestria-v2] No command templates found in "${COMMANDS_DIR}"; skipping command registration.`,
      );
      return;
    }

    yield* ctx.command.transform((editor) => {
      for (const [name, template] of templates) {
        try {
          editor.add({
            description: COMMAND_DESCRIPTIONS[name],
            execute: (input) =>
              ctx.session
                .prompt({
                  agents: input.prompt.agents,
                  delivery: input.delivery,
                  files: input.prompt.files,
                  sessionID: input.sessionID,
                  skills: input.prompt.skills,
                  text: `${template}\n\n${input.prompt.text}`,
                })
                .pipe(Effect.asVoid),
            name,
          });
        } catch (error) {
          console.warn(`[maestria-v2] Failed to register command "${name}":`, error);
        }
      }
    });
  });
