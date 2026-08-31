import type {
  BeforeAgentStartEvent,
  BeforeAgentStartEventResult,
} from '@earendil-works/pi-coding-agent';
import { getModePrompt } from '@maestria/shared-pi/modes-core';
import path from 'node:path';

import type { MaestriaState } from '@/state.js';

const __dirname = import.meta.dirname;
const COMMANDS_DIR = path.resolve(__dirname, '../agents/commands');

/**
 * Creates a before_agent_start handler that injects workflow mode prompts.
 *
 * This is the only dynamic prompt injection needed from the extension.
 * Static behavioral content (orchestrator prompt + global rules) is
 * auto-injected by Pi's skill system via SKILL.md files registered in
 * the pi.skills manifest field - the standard Pi extension pattern.
 *
 * When no mode is active, the handler returns an empty result (no modification),
 * letting Pi's built-in prompt assembly (skills + context files + tools)
 * stand as-is.
 */
export const createModePromptHandler =
  (state: MaestriaState) =>
  (event: BeforeAgentStartEvent, _ctx: object): BeforeAgentStartEventResult => {
    if (state.mode === null) {
      return {};
    }

    const parts: string[] = [
      event.systemPrompt,
      '',
      getModePrompt(state.mode, COMMANDS_DIR),
      '',
      `The user has set workflow mode to "${state.mode}". ` +
        'Honor this mode throughout the session until changed via /command.',
    ];

    return { systemPrompt: parts.join('\n') };
  };
