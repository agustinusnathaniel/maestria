import {
  formatProjectErrorBanner,
  formatProjectSection,
  tryLoadProjectSections,
} from '@maestria/shared-pi/project-config';
import type { ProjectConfigFs, ProjectPromptContext } from '@maestria/shared-pi/project-config';
import { getModePrompt } from '@maestria/shared-pi/modes-core';
import type { BeforeAgentStartEvent, BeforeAgentStartEventResult } from '@oh-my-pi/pi-coding-agent';

import type { MaestriaState } from '@maestria/shared-pi/state-core';

const __dirname = import.meta.dirname;
const COMMANDS_DIR = `${__dirname}/../agents/commands`;

/**
 * Creates a before_agent_start handler injecting the mode prompt plus root
 * project customization (workflow then rules, read fresh from ctx.cwd each
 * turn; absent files leave the prompt unchanged). Returns undefined when
 * idle. Never throws: broken files surface via notify plus a STOP banner
 * appended to the systemPrompt array (the OMP host swallows handler
 * exceptions). See ADR-CORE-006.
 */
export const createModePromptHandler =
  (state: MaestriaState, fs?: ProjectConfigFs) =>
  (
    event: BeforeAgentStartEvent,
    ctx?: ProjectPromptContext,
  ): BeforeAgentStartEventResult | undefined => {
    const loaded = tryLoadProjectSections(ctx, fs);
    if (loaded.errorMessage !== undefined) {
      return {
        systemPrompt: [...event.systemPrompt, '', formatProjectErrorBanner(loaded.errorMessage)],
      };
    }
    const { sections } = loaded;

    if (!state.mode && sections.length === 0) {
      return undefined;
    }

    const parts: string[] = [...event.systemPrompt, ''];
    if (state.mode) {
      parts.push(
        getModePrompt(state.mode, COMMANDS_DIR),
        '',
        `The user has set workflow mode to "${state.mode}". ` +
          'Honor this mode throughout the session until changed via /command.',
        '',
      );
    }
    for (const section of sections) {
      parts.push(formatProjectSection(section), '');
    }

    return { systemPrompt: parts };
  };
