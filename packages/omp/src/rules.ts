import { getModePrompt } from '@maestria/shared-pi/modes-core';
import type {
  BeforeAgentStartEvent,
  BeforeAgentStartEventResult,
  ExtensionContext,
} from '@oh-my-pi/pi-coding-agent';

import type { MaestriaState } from '@/state.js';

const __dirname = import.meta.dirname;
const COMMANDS_DIR = `${__dirname}/../agents/commands`;

/**
 * Creates a before_agent_start handler that injects workflow mode prompts.
 *
 * This is the only dynamic prompt injection needed from the extension.
 * Static behavioral content (orchestrator prompt + global rules) is
 * auto-injected by the platform's skill system via SKILL.md files registered in
 * omp's agent discovery mechanism.
 *
 * When no mode is active, the handler returns void (no modification),
 * letting the platform's prompt assembly (skills + context files + tools)
 * stand as-is.
 */
export function createModePromptHandler(state: MaestriaState) {
  return (
    event: BeforeAgentStartEvent,
    _ctx: ExtensionContext,
  ): BeforeAgentStartEventResult | void => {
    if (!state.mode) {
      return;
    }

    const parts: string[] = [
      ...event.systemPrompt,
      '',
      getModePrompt(state.mode, COMMANDS_DIR),
      '',
      `The user has set workflow mode to "${state.mode}". ` +
        'Honor this mode throughout the session until changed via /command.',
    ];

    return { systemPrompt: parts };
  };
}
