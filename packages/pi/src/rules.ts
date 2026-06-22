import type {
  BeforeAgentStartEvent,
  BeforeAgentStartEventResult,
  ExtensionContext,
} from '@earendil-works/pi-coding-agent';
import type { MaestriaState } from './state.js';
import { getModePrompt } from './modes.js';

export function createBeforeAgentStartHandler(state: MaestriaState) {
  return (
    event: BeforeAgentStartEvent,
    _ctx: ExtensionContext,
  ): BeforeAgentStartEventResult | void => {
    if (state.mode) {
      return {
        systemPrompt: [
          event.systemPrompt,
          '',
          getModePrompt(state.mode),
          '',
          `The user has set workflow mode to "${state.mode}". `,
          'Honor this mode throughout the session until changed via /command.',
        ].join('\n'),
      };
    }
  };
}
