import type {
  BeforeAgentStartEvent,
  BeforeAgentStartEventResult,
  ExtensionContext,
} from '@earendil-works/pi-coding-agent';
import type { MaestriaState } from '@/state.js';
import { getModePrompt } from '@/modes.js';

/**
 * Creates a before_agent_start handler that injects workflow mode prompts.
 *
 * This is the only dynamic prompt injection needed from the extension.
 * Static behavioral content (orchestrator prompt + global rules) is
 * auto-injected by Pi's skill system via SKILL.md files registered in
 * the pi.skills manifest field - the standard Pi extension pattern.
 *
 * When no mode is active, the handler returns void (no modification),
 * letting Pi's built-in prompt assembly (skills + context files + tools)
 * stand as-is.
 */
export function createModePromptHandler(state: MaestriaState) {
  return (
    event: BeforeAgentStartEvent,
    _ctx: ExtensionContext,
  ): BeforeAgentStartEventResult | void => {
    if (!state.mode) return;

    const parts: string[] = [
      event.systemPrompt,
      '',
      getModePrompt(state.mode),
      '',
      `The user has set workflow mode to "${state.mode}". ` +
        'Honor this mode throughout the session until changed via /command.',
    ];

    return { systemPrompt: parts.join('\n') };
  };
}
