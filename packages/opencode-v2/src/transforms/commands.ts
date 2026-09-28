import path from 'node:path';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import { MODE_KEYWORDS } from '@maestria/shared-mode';
import type { ModeKeyword } from '@maestria/shared-mode';
import type { CommandDraft, Transform } from '@/types.js';
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

// Workflow mode commands via `command.transform`. The pinned SDK has no
// `add()`, only list/get/update/remove, so missing commands warn instead of
// throwing (operator re-runs sync or checks `sync.config.ts`).
export const registerCommandTransforms = (ctx: {
  command: { transform: Transform<CommandDraft> };
}): Effect.Effect<void, never, Scope.Scope> =>
  Effect.gen(function* registerCommandTransformsEffect() {
    yield* ctx.command.transform((draft: CommandDraft) => {
      for (const name of MODE_KEYWORDS) {
        // readSyncedMarkdown warns and returns null when the synced template
        // is missing; the template renders as prompt content on /<name>.
        const template = readSyncedMarkdown(path.join(COMMANDS_DIR, `${name}.md`), 'command');
        if (template === null) {
          continue;
        }

        try {
          const existing = draft.get(name);
          if (existing) {
            draft.update(name, (cmd) => {
              cmd.template = template;
              cmd.description = COMMAND_DESCRIPTIONS[name];
            });
          } else {
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
