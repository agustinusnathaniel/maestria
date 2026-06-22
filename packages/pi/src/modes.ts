import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { MaestriaState } from './state.js';
import { persistState, restoreOriginalState } from './state.js';

export const MODE_KEYWORDS = ['fein', 'sonar', 'blitz'] as const;
export type ModeKeyword = (typeof MODE_KEYWORDS)[number];

const MODE_PROMPTS: Record<ModeKeyword, string> = {
  fein: [
    '## MODE: fein (Full Pipeline)',
    '',
    'Execute the complete fein pipeline: mandatory reconnaissance',
    '(@adventurer) → design/plan (@architect or @planner) →',
    'implementation (@builder) → review (@reviewer).',
    'Do NOT skip any phase unless the user explicitly overrides',
    'in the same turn.',
  ].join('\n'),
  sonar: [
    '## MODE: sonar (Research Only)',
    '',
    'Execute research only: @adventurer (recon) →',
    '@architect or @planner (design/plan) → STOP.',
    'Do NOT implement anything. Return findings.',
  ].join('\n'),
  blitz: [
    '## MODE: blitz (Fast Implementation)',
    '',
    'Execute fast implementation via @builder directly.',
    'Skip reconnaissance and design unless the codebase',
    'is genuinely unknown. Skip review unless the result',
    'needs validation.',
  ].join('\n'),
};

const MODE_MARKERS: Record<ModeKeyword, string> = {
  fein: '[MODE: fein]',
  sonar: '[MODE: sonar]',
  blitz: '[MODE: blitz]',
};

export function getModePrompt(keyword: ModeKeyword): string {
  return `${MODE_MARKERS[keyword]}\n\n${MODE_PROMPTS[keyword]}`;
}

export function installModeCommands(pi: ExtensionAPI, state: MaestriaState): void {
  for (const keyword of MODE_KEYWORDS) {
    pi.registerCommand(keyword, {
      description: `Set workflow mode to ${keyword}`,
      handler: async (args, ctx) => {
        // Exit review mode if active (restore original model/tools)
        if (state.reviewMode) {
          await restoreOriginalState(pi, ctx, state);
        }

        state.mode = keyword;
        persistState(pi, state);

        if (args.trim()) {
          const modeMessage = [
            getModePrompt(keyword),
            '',
            `Run the maestria default pipeline on: ${args}`,
          ].join('\n');
          pi.sendUserMessage(modeMessage, { deliverAs: 'steer' });
        } else {
          ctx.ui.notify(`Mode set to ${keyword}. Describe what you'd like to work on.`);
        }
      },
    });
  }
}
