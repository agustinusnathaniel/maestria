import path from 'node:path';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import { MODE_KEYWORDS } from '@maestria/shared-mode';
import type { ModeKeyword } from '@maestria/shared-mode';
import type { CommandDraft, Transform } from '@/types.js';
import { readSyncedMarkdown } from '@/markdown.js';
import { COMMANDS_DIR } from '@/root.js';

/**
 * Descriptions mirror the canonical frontmatter at
 * `packages/core/agent-directives/commands/*.md` (stripped by sync, so the
 * runtime copy lives here).
 */
const COMMAND_DESCRIPTIONS: Record<ModeKeyword, string> = {
  blitz: 'Fast capability-aware route - skip optional recon and design ceremony',
  fein: 'Full pipeline - recon, design, implement, review',
  sonar: 'Research only - read-only recon and planning, stop before implementation',
};

/**
 * Register workflow mode commands via `command.transform`.
 *
 * Template model (pinned SDK has no `add()`, only list/get/update/remove;
 * live docs describe a newer execute-callback shape - see the README API
 * table). Missing commands are filesystem-discovered from `agents/commands/`
 * after sync, so absent entries warn instead of throwing.
 */

export const registerCommandTransforms = (ctx: {
  command: { transform: Transform<CommandDraft> };
}): Effect.Effect<void, never, Scope.Scope> =>
  Effect.gen(function* registerCommandTransformsEffect() {
    yield* ctx.command.transform((draft: CommandDraft) => {
      for (const name of MODE_KEYWORDS) {
        // readSyncedMarkdown warns and returns null when the synced template
        // is missing; the template is rendered as prompt content on /<name>.
        const template = readSyncedMarkdown(path.join(COMMANDS_DIR, `${name}.md`), 'command');
        if (template === null) {
          continue;
        }
        const description = COMMAND_DESCRIPTIONS[name];

        try {
          const existing = draft.get(name);
          if (existing) {
            draft.update(name, (cmd) => {
              cmd.template = template;
              cmd.description = description;
            });
          } else {
            // No add() on this pin - warn so the operator re-runs sync or
            // checks the `sync.config.ts` command entries.
            console.warn(
              `[maestria-v2] Command "${name}" not found in draft (no add() available) - ensure sync copied it to ${COMMANDS_DIR}.`,
            );
          }
        } catch (error) {
          console.warn(`[maestria-v2] Failed to register command "${name}":`, error);
        }
      }
    });
  });
