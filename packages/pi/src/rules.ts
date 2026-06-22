import type {
  BeforeAgentStartEvent,
  BeforeAgentStartEventResult,
  ExtensionContext,
} from '@earendil-works/pi-coding-agent';
import type { MaestriaState } from './state.js';
import { getModePrompt } from './modes.js';
import { RULES_CONTENT } from './rules-content.js';

export function createBeforeAgentStartHandler(state: MaestriaState) {
  return (
    event: BeforeAgentStartEvent,
    _ctx: ExtensionContext,
  ): BeforeAgentStartEventResult | void => {
    const parts: string[] = [RULES_CONTENT, '', event.systemPrompt];

    if (state.mode) {
      parts.push('', getModePrompt(state.mode));
      parts.push(
        '',
        `The user has set workflow mode to "${state.mode}". ` +
          'Honor this mode throughout the session until changed via /command.',
      );
    }

    return { systemPrompt: parts.join('\n') };
  };
}
