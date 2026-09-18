import type {
  BeforeAgentStartEvent,
  BeforeAgentStartEventResult,
} from '@earendil-works/pi-coding-agent';
import {
  formatProjectErrorBanner,
  formatProjectSection,
  loadProjectSections,
} from '@maestria/shared-pi/project-config';
import type { ProjectConfigFs } from '@maestria/shared-pi/project-config';
import { getModePrompt } from '@maestria/shared-pi/modes-core';
import path from 'node:path';

import type { MaestriaState } from '@maestria/shared-pi/state-core';

const __dirname = import.meta.dirname;
const COMMANDS_DIR = path.resolve(__dirname, '../agents/commands');

/** Minimal host context surface this handler reads: session cwd plus notify. */
export interface ProjectPromptContext {
  cwd?: unknown;
  ui?: { notify?: (message: string) => void };
}

const readRoot = (ctx: ProjectPromptContext | undefined): string | undefined =>
  typeof ctx?.cwd === 'string' && ctx.cwd !== '' ? ctx.cwd : undefined;

const notifyProjectError = (ctx: ProjectPromptContext | undefined, message: string): void => {
  try {
    ctx?.ui?.notify?.(message);
  } catch {
    // Notify is best-effort UI surfacing; the banner below is authoritative.
  }
};

/**
 * Creates a before_agent_start handler that injects workflow mode prompts and
 * root project customization.
 *
 * Static behavioral content (orchestrator prompt + global rules) is
 * auto-injected by Pi's skill system via SKILL.md files registered in
 * the pi.skills manifest field - the standard Pi extension pattern.
 *
 * Project customization (`.maestria/workflow.md` then `.maestria/rules.md`,
 * root-only, no ancestor scan) is read fresh from the host-selected session
 * cwd (`ctx.cwd`) on every turn, so edits apply on the next turn with no
 * restart and no persisted copies. Absent files leave the prompt unchanged.
 *
 * When no mode is active and no project file is present, the handler returns
 * an empty result (no modification), letting Pi's built-in prompt assembly
 * stand as-is.
 *
 * Fail-loud path: the Pi host swallows `before_agent_start` exceptions
 * (verified against pinned `@earendil-works/pi-coding-agent` 0.84.2:
 * `emitBeforeAgentStart` catches handler errors into `emitError` and
 * continues), so this handler never throws. A present-but-unusable project
 * file surfaces via `ctx.ui.notify` plus a STOP banner in the returned
 * system prompt instead of running with silently absent config.
 */
export const createModePromptHandler =
  (state: MaestriaState, fs?: ProjectConfigFs) =>
  (event: BeforeAgentStartEvent, ctx?: ProjectPromptContext): BeforeAgentStartEventResult => {
    const root = readRoot(ctx);
    let sections: { content: string; rel: string }[] = [];
    if (root !== undefined) {
      try {
        sections = fs === undefined ? loadProjectSections(root) : loadProjectSections(root, fs);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        notifyProjectError(ctx, message);
        return {
          systemPrompt: [event.systemPrompt, '', formatProjectErrorBanner(message)].join('\n'),
        };
      }
    }

    if (state.mode === null && sections.length === 0) {
      return {};
    }

    const parts: string[] = [event.systemPrompt, ''];
    if (state.mode !== null) {
      parts.push(
        getModePrompt(state.mode, COMMANDS_DIR),
        '',
        `The user has set workflow mode to "${state.mode}". ` +
          'Honor this mode throughout the session until changed via /command.',
        '',
      );
    }
    for (const section of sections) {
      parts.push(formatProjectSection(section), '');
    }

    return { systemPrompt: parts.join('\n') };
  };
