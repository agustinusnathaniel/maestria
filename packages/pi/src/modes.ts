import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { MaestriaState } from '@/state.js';
import { persistState, restoreOriginalState } from '@/state.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMMANDS_DIR = resolve(__dirname, '../agents/commands');

function loadModePrompt(name: string): string {
  const content = readFileSync(resolve(COMMANDS_DIR, `${name}.md`), 'utf-8');
  const modeIdx = content.indexOf('## MODE:');
  if (modeIdx !== -1) {
    return content.slice(modeIdx).replace(/\s+$/, '') + '\n';
  }
  return content.replace(/\s+$/, '') + '\n';
}

export const MODE_KEYWORDS = ['fein', 'sonar', 'blitz'] as const;
export type ModeKeyword = (typeof MODE_KEYWORDS)[number];

const MODE_MARKERS: Record<ModeKeyword, string> = {
  fein: '[MODE: fein]',
  sonar: '[MODE: sonar]',
  blitz: '[MODE: blitz]',
};

/** Lazily cached mode prompts — loaded on first access, never throws. */
const _promptCache: Partial<Record<ModeKeyword, string>> = {};

export function getModePrompt(keyword: ModeKeyword): string {
  if (!(keyword in _promptCache)) {
    try {
      _promptCache[keyword] = loadModePrompt(keyword);
    } catch (e) {
      console.warn(`[maestria] Failed to load mode prompt "${keyword}":`, e);
      _promptCache[keyword] = '';
    }
  }
  return `${MODE_MARKERS[keyword]}\n\n${_promptCache[keyword]}`;
}

export function installModeCommands(pi: ExtensionAPI, state: MaestriaState): void {
  for (const keyword of MODE_KEYWORDS) {
    pi.registerCommand(keyword, {
      description: `Set workflow mode to ${keyword}`,
      handler: async (args, ctx) => {
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
