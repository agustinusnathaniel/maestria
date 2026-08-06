import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  BeforeAgentStartEvent,
  BeforeAgentStartEventResult,
  ExtensionContext,
} from '@oh-my-pi/pi-coding-agent';
import type { MaestriaState } from '@/state.js';
import { getModePrompt, type ModeController } from '@maestria/shared-pi/modes-core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMMANDS_DIR = __dirname + '/../agents/commands';

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
export function createModePromptHandler(
  state: MaestriaState,
  modeController?: Pick<ModeController, 'getMode'>,
) {
  return (
    event: BeforeAgentStartEvent,
    _ctx: ExtensionContext,
  ): BeforeAgentStartEventResult | void => {
    const mode = modeController?.getMode() ?? state.mode;
    if (!mode) return;

    const parts: string[] = [
      ...event.systemPrompt,
      '',
      getModePrompt(mode, COMMANDS_DIR),
      '',
      `The user has selected workflow mode "${mode}" for this turn. ` +
        'Explicit slash-command modes remain active until changed via /command.',
    ];

    return { systemPrompt: parts };
  };
}
