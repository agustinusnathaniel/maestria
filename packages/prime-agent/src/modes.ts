// packages/prime-agent/src/modes.ts
// Prime-local implementation of the Maestria workflow modes (fein/sonar/blitz).
//
// Pure mode mechanics (keywords, markers, `## MODE:` section extraction)
// delegate to `@maestria/shared-mode`, mirroring
// packages/opencode/src/modes/index.ts. Host-specific concerns stay
// Prime-local: the `skills/<mode>/SKILL.md` layout, the module prompt cache,
// `before_agent_start` string-shape injection, and slash-command registration.
// This module still imports no `@maestria/pi`, `@maestria/shared-pi`, or
// pi-coding-agent runtime (only the type-only `./pi-api.js` plus the pure,
// host-SDK-free `@maestria/shared-mode`); `shared-mode` has no filesystem or
// host APIs.
//
// Mode content is NOT duplicated here: it is loaded from the package's
// generated skills (`skills/<mode>/SKILL.md`, the `## MODE:` section onward),
// so the extension's injected prompt is exactly the sync-projected mode skill
// (canonical content lives in packages/core/agent-directives/, ADR-CORE-005).

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { extractModeSection, MODE_KEYWORDS, MODE_MARKERS } from '@maestria/shared-mode';
import type { ModeKeyword } from '@maestria/shared-mode';

import type {
  BeforeAgentStartEvent,
  BeforeAgentStartEventResult,
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
} from './pi-api.js';
import {
  formatProjectErrorBanner,
  formatProjectSection,
  loadProjectSections,
} from './project-config.js';
import type { ProjectConfigFs } from './project-config.js';
import type { MaestriaModeState } from './state.js';
import { persistModeState } from './state.js';

export { MODE_KEYWORDS, MODE_MARKERS } from '@maestria/shared-mode';
export type { ModeKeyword } from '@maestria/shared-mode';

const MODE_COMMAND_DESCRIPTIONS: Record<ModeKeyword, string> = {
  blitz: 'Set workflow mode to blitz (fast path)',
  fein: 'Set workflow mode to fein (full pipeline)',
  sonar: 'Set workflow mode to sonar (research only)',
};

// ---------------------------------------------------------------------------
// Mode prompt loading (from generated skills)
// ---------------------------------------------------------------------------

const _promptCache: Partial<Record<ModeKeyword, string>> = {};

/**
 * Load the mode prompt for a keyword from the package's generated skills
 * directory: `skills/<mode>/SKILL.md`, sliced from the `## MODE:` heading
 * onward, prefixed with the `[MODE: <mode>]` marker. Returns an empty string
 * (and warns) when the skill file is missing or has no mode section, so a
 * packaging mistake degrades to "no injection" rather than an extension crash.
 */
export const getModePrompt = (keyword: ModeKeyword, skillsDir: string): string => {
  const cachedPrompt = _promptCache[keyword];
  if (cachedPrompt !== undefined) {
    return cachedPrompt;
  }

  let prompt = '';
  try {
    const content = readFileSync(path.join(skillsDir, keyword, 'SKILL.md'), 'utf-8');
    if (content.includes('## MODE:')) {
      prompt = `${MODE_MARKERS[keyword]}\n\n${extractModeSection(content)}`;
    } else {
      // A generated skill without the mode section must not leak the whole
      // SKILL.md into the system prompt: degrade to "no injection" instead.
      // (extractModeSection would normalize the whole file; that fail-open
      // shape is for command files, not skill prompts.)
      console.warn(
        `[maestria] prime-agent: mode skill "${keyword}" has no "## MODE:" heading; ` +
          `mode prompt injection disabled for this mode.`,
      );
    }
  } catch (error) {
    console.warn(
      `[maestria] prime-agent: failed to load mode skill "${keyword}" from ${skillsDir}; ` +
        `mode prompt injection disabled for this mode.`,
      error,
    );
  }
  _promptCache[keyword] = prompt;
  return prompt;
};

// ---------------------------------------------------------------------------
// before_agent_start mode prompt injection
// ---------------------------------------------------------------------------

/**
 * Create the `before_agent_start` handler appending the mode prompt plus
 * root project customization (workflow then rules, read fresh from ctx.cwd
 * each turn; absent files leave the prompt unchanged). Returns undefined
 * when idle. Never throws: broken files surface via notify plus a STOP
 * banner (host swallowing is [inferred] from Pi-lineage behavior).
 * See ADR-CORE-006.
 */
export const createModePromptHandler =
  (
    state: MaestriaModeState,
    skillsDir: string,
    fs?: ProjectConfigFs,
  ): ((
    event: BeforeAgentStartEvent,
    ctx?: ExtensionContext,
  ) => BeforeAgentStartEventResult | undefined) =>
  (
    event: BeforeAgentStartEvent,
    ctx?: ExtensionContext,
  ): BeforeAgentStartEventResult | undefined => {
    const root = typeof ctx?.cwd === 'string' && ctx.cwd !== '' ? ctx.cwd : undefined;
    let sections: { content: string; rel: string }[] = [];
    if (root !== undefined) {
      try {
        sections = fs === undefined ? loadProjectSections(root) : loadProjectSections(root, fs);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        try {
          ctx?.ui?.notify?.(message);
        } catch {
          // Notify is best-effort; the banner below is authoritative.
        }
        return {
          systemPrompt: [event.systemPrompt, '', formatProjectErrorBanner(message)].join('\n'),
        };
      }
    }

    if (!state.mode && sections.length === 0) {
      return undefined;
    }

    const parts: string[] = [event.systemPrompt, ''];
    if (state.mode) {
      const modePrompt = getModePrompt(state.mode, skillsDir);
      if (modePrompt) {
        parts.push(
          modePrompt,
          '',
          `The user has set workflow mode to "${state.mode}". Honor this mode throughout the session until it is changed or cleared.`,
          '',
        );
      } else if (sections.length === 0) {
        return undefined;
      }
    }
    for (const section of sections) {
      parts.push(formatProjectSection(section), '');
    }

    return {
      systemPrompt: parts.join('\n'),
    };
  };

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

const MODE_CLEAR_COMMAND = 'mode-clear';
export const STATUS_COMMAND = 'maestria-status';

/**
 * Install the mode slash commands (`/fein`, `/sonar`, `/blitz`, `/mode-clear`)
 * and the status/help command (`/maestria-status`). Mode selection is persisted
 * as a session custom entry; the prompt is injected on the next agent turn by
 * the `before_agent_start` handler.
 */
export const installCommands = (pi: ExtensionAPI, state: MaestriaModeState): void => {
  for (const keyword of MODE_KEYWORDS) {
    pi.registerCommand(keyword, {
      description: MODE_COMMAND_DESCRIPTIONS[keyword],
      handler: async (args: string, ctx: ExtensionCommandContext) => {
        state.mode = keyword;
        persistModeState(pi, state);
        // Forward a goal argument (e.g. `/fein implement the pipeline`) so the
        // injected mode prompt's "if the user provided a goal, run it now"
        // instruction has the goal to act on.
        if (args.trim()) {
          pi.sendUserMessage(args.trim(), { deliverAs: 'steer' });
        } else {
          ctx.ui.notify(`Mode set to ${keyword}. Describe what you'd like to work on.`);
        }
        await Promise.resolve();
      },
    });
  }

  pi.registerCommand(MODE_CLEAR_COMMAND, {
    description: 'Clear workflow mode and return to neutral routing',
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      state.mode = null;
      persistModeState(pi, state);
      ctx.ui.notify('Workflow mode cleared. Neutral routing is active.');
      await Promise.resolve();
    },
  });

  pi.registerCommand(STATUS_COMMAND, {
    description: 'Show the current maestria workflow mode and extension subset',
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      const mode = state.mode ?? 'none';
      const summary = [
        '# Maestria status (prime-agent)',
        '',
        `Workflow mode: ${mode}`,
        '',
        'Commands: /fein, /sonar, /blitz, /mode-clear',
        '',
        'This extension covers mode selection and mode prompt injection only.',
        'Recursive-subagent (rlm) dispatch and JSON/RPC headless mode are NOT provided by this package.',
      ].join('\n');
      ctx.ui.setEditorText(summary);
      await Promise.resolve();
    },
  });
};
