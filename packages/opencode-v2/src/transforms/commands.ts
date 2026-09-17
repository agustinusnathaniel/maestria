import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import type { CommandDraft, Transform } from '@/types.js';
import { COMMANDS_DIR } from '@/root.js';

const VALID_COMMANDS = ['fein', 'sonar', 'blitz'] as const;
type ValidCommand = (typeof VALID_COMMANDS)[number];

/**
 * Descriptions sourced from canonical frontmatter at
 * `packages/core/agent-directives/commands/*.md` (stripped by sync).
 * Keep in sync with sync.config.ts command descriptions if they change.
 */
const COMMAND_DESCRIPTIONS: Record<ValidCommand, string> = {
  blitz: 'Fast capability-aware route - skip optional recon and design ceremony',
  fein: 'Full pipeline - recon, design, implement, review',
  sonar: 'Research only - read-only recon and planning, stop before implementation',
};

const stripAutoGenComment = (content: string): string => {
  const trimmed = content.trimStart();
  if (trimmed.startsWith('<!--')) {
    const end = trimmed.indexOf('-->');
    if (end !== -1) {
      return trimmed.slice(end + 3).trimStart();
    }
  }
  return content;
};

const loadCommandTemplate = (name: ValidCommand): string | null => {
  const filePath = path.join(COMMANDS_DIR, `${name}.md`);
  if (!existsSync(filePath)) {
    return null;
  }
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const stripped = stripAutoGenComment(raw).trim();
    // The synced file is already just the mode prompt (e.g. "[MODE: fein]\n\n## MODE: fein ...").
    // Return as-is; CommandInfo.template is rendered as prompt content when the user runs /<name>.
    // Ensure trailing newline for consistency with MODE_PROMPTS extraction.
    return `${stripped.replace(/\s+$/u, '')}\n`;
  } catch (error) {
    console.warn(`[maestria-v2] Failed to read command "${name}":`, error);
    return null;
  }
};

const deriveDescription = (template: string, fallback: string): string => {
  // Prefer the first heading line after the [MODE: ...] marker as a concise description, e.g.
  // "## MODE: fein (Full Pipeline)" -> "Full pipeline - recon, design, implement, review"
  // If no heading is found, fall back to the canonical frontmatter description.
  const headingMatch = /^##\s+MODE:\s+[^\n]*$/mu.exec(template);
  if (headingMatch) {
    const line = headingMatch[0].replace(/^##\s+MODE:\s+/u, '').trim();
    // Strip parenthetical suffix, e.g. "fein (Full Pipeline)" -> keep full line as-is but prefer fallback if too long
    if (line.length > 0 && line.length < 80) {
      return line;
    }
  }
  return fallback;
};

/**
 * Register workflow mode commands via `command.transform`.
 *
 * Ground truth - CommandInfo shape (from @opencode-ai/client):
 *   { name: string, template: string, description?: string, agent?: string, model?: ModelRef, subtask?: boolean }
 *
 * Draft shape (from @opencode-ai/plugin/effect/command):
 *   CommandDraft { list(), get(name), update(name, fn), remove(name) } - NOTE: no `add()` method.
 *   SkillDraft DOES expose `add()`, but CommandDraft currently does not. The runtime is checked
 *   defensively: if `draft.add` exists it is used; otherwise existing commands are updated in place
 *   and missing commands are warned (they will be discovered via filesystem sync at `agents/commands/`).
 *
 * Docs example `draft.add({ name, description, execute: async (...) => ctx.session.prompt(...) })`
 * reflects an older/proposed API where commands could carry an execute callback. The current
 * generated CommandInfo is template-only (no execute). Keep this file aligned to the template model;
 * if `execute`-style commands land in a future `@opencode-ai/plugin` bump, this transform can be
 * extended to register `execute` handlers.
 */
type CommandAdd = (info: { description?: string; name: string; template: string }) => void;

// Runtime feature detection for `add` if a future SDK adds it (CommandDraft currently
// exposes list/get/update/remove only). The `in` predicate keeps the narrow branch
// type-safe without a cast; the update-only path below stays the supported behavior.
const isAddCapable = (value: CommandDraft): value is CommandDraft & { add?: CommandAdd } =>
  'add' in value;

export const registerCommandTransforms = (ctx: {
  command: { transform: Transform<CommandDraft> };
}): Effect.Effect<void, never, Scope.Scope> =>
  Effect.gen(function* registerCommandTransformsEffect() {
    yield* ctx.command.transform((draft: CommandDraft) => {
      for (const name of VALID_COMMANDS) {
        const template = loadCommandTemplate(name);
        if (template === null) {
          console.warn(
            `[maestria-v2] Command "${name}" skipped: template file not found at ${path.join(COMMANDS_DIR, `${name}.md`)}`,
          );
          continue;
        }
        const description = COMMAND_DESCRIPTIONS[name];
        // Derive could use heading, but canonical frontmatter description is preferred for slash-command palette brevity.
        const _derived = deriveDescription(template, description);

        try {
          const existing = draft.get(name);
          if (existing) {
            draft.update(name, (cmd) => {
              cmd.template = template;
              cmd.description = description;
            });
          } else if (isAddCapable(draft) && typeof draft.add === 'function') {
            draft.add({ description, name, template });
          } else {
            // No add() - only update existing filesystem-discovered commands.
            // Commands are filesystem-discovered from `agents/commands/` after sync; warn if missing
            // so the operator knows to re-run sync or check `sync.config.ts` command entries.
            console.warn(
              `[maestria-v2] Command "${name}" not found in draft (no add() available) - ensure sync copied it to ${COMMANDS_DIR}. Template would have been registered if add() existed.`,
            );
          }
        } catch (error) {
          console.warn(`[maestria-v2] Failed to register command "${name}":`, error);
        }
      }
    });
  });
