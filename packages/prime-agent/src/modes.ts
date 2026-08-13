// packages/prime-agent/src/modes.ts
// Prime-local implementation of the Maestria workflow modes (fein/sonar/blitz).
//
// Behavioral model: the @maestria/pi extension's mode implementation
// (packages/pi/src/modes.ts + packages/shared/pi/src/modes-core.ts), adapted to
// the Prime fork's public extension API and to this package's skills-first
// projection. This module is deliberately self-contained (Prime-local thin
// extension): it does not import @maestria/pi or @maestria/shared-pi, and it
// uses only the public ExtensionAPI surface mirrored in ./pi-api.ts.
//
// Mode content is NOT duplicated here: it is loaded from the package's
// generated skills (`skills/<mode>/SKILL.md`, the `## MODE:` section onward),
// so the extension's injected prompt is exactly the sync-projected mode skill
// (canonical content lives in packages/core/agent-directives/, ADR-CORE-005).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  BeforeAgentStartEvent,
  BeforeAgentStartEventResult,
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
} from './pi-api.js';
import type { MaestriaModeState } from './state.js';
import { persistModeState } from './state.js';

export const MODE_KEYWORDS = ['fein', 'sonar', 'blitz'] as const;
export type ModeKeyword = (typeof MODE_KEYWORDS)[number];

/** Marker line prepended to injected mode content (shared with other Maestria platforms). */
export const MODE_MARKERS: Record<ModeKeyword, string> = {
  fein: '[MODE: fein]',
  sonar: '[MODE: sonar]',
  blitz: '[MODE: blitz]',
};

const MODE_COMMAND_DESCRIPTIONS: Record<ModeKeyword, string> = {
  fein: 'Set workflow mode to fein (full pipeline)',
  sonar: 'Set workflow mode to sonar (research only)',
  blitz: 'Set workflow mode to blitz (fast path)',
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
export function getModePrompt(keyword: ModeKeyword, skillsDir: string): string {
  if (keyword in _promptCache) return _promptCache[keyword]!;

  let prompt = '';
  try {
    const content = readFileSync(join(skillsDir, keyword, 'SKILL.md'), 'utf8');
    const modeIdx = content.indexOf('## MODE:');
    if (modeIdx === -1) {
      // A generated skill without the mode section must not leak the whole
      // SKILL.md into the system prompt: degrade to "no injection" instead.
      console.warn(
        `[maestria] prime-agent: mode skill "${keyword}" has no "## MODE:" heading; ` +
          `mode prompt injection disabled for this mode.`,
      );
    } else {
      const body = content.slice(modeIdx);
      prompt = `${MODE_MARKERS[keyword]}\n\n${body.replace(/\s+$/, '')}\n`;
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
}

// ---------------------------------------------------------------------------
// before_agent_start mode prompt injection
// ---------------------------------------------------------------------------

/**
 * Create the `before_agent_start` handler that appends the active mode prompt
 * to the chained system prompt. Returns void when no mode is active (no
 * modification), so Prime's normal prompt assembly stands as-is.
 */
export function createModePromptHandler(
  state: MaestriaModeState,
  skillsDir: string,
): (event: BeforeAgentStartEvent, _ctx: ExtensionContext) => BeforeAgentStartEventResult | void {
  return (event: BeforeAgentStartEvent): BeforeAgentStartEventResult | void => {
    if (!state.mode) return;

    const modePrompt = getModePrompt(state.mode, skillsDir);
    if (!modePrompt) return;

    return {
      systemPrompt: [
        event.systemPrompt,
        '',
        modePrompt,
        '',
        `The user has set workflow mode to "${state.mode}". Honor this mode throughout the session until it is changed or cleared.`,
      ].join('\n'),
    };
  };
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

export const MODE_CLEAR_COMMAND = 'mode-clear';
export const STATUS_COMMAND = 'maestria-status';

/**
 * Install the mode slash commands (`/fein`, `/sonar`, `/blitz`, `/mode-clear`)
 * and the status/help command (`/maestria-status`). Mode selection is persisted
 * as a session custom entry; the prompt is injected on the next agent turn by
 * the `before_agent_start` handler.
 */
export function installCommands(pi: ExtensionAPI, state: MaestriaModeState): void {
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
      },
    });
  }

  pi.registerCommand(MODE_CLEAR_COMMAND, {
    description: 'Clear workflow mode and return to neutral routing',
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      state.mode = null;
      persistModeState(pi, state);
      ctx.ui.notify('Workflow mode cleared. Neutral routing is active.');
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
    },
  });
}
