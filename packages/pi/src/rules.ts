import type {
  BeforeAgentStartEvent,
  BeforeAgentStartEventResult,
} from '@earendil-works/pi-coding-agent';
import {
  formatProjectErrorBanner,
  formatProjectSection,
  tryLoadProjectSections,
} from '@maestria/shared-pi/project-config';
import type { ProjectConfigFs, ProjectPromptContext } from '@maestria/shared-pi/project-config';
import { getModePrompt } from '@maestria/shared-pi/modes-core';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { MaestriaState } from '@maestria/shared-pi/state-core';

const __dirname = import.meta.dirname;
const COMMANDS_DIR = path.resolve(__dirname, '../agents/commands');
const SKILLS_DIR = path.resolve(__dirname, '../skills');

/** The skill files that carry the always-on core: the main loop, then the global rules. */
const CORE_SKILLS = ['maestria', 'global-rules'] as const;
const SKILL_HEADER = /^---\n[\s\S]*?\n---\n\s*(?:<!--[\s\S]*?-->\s*)?/u;

/** The always-on core, read from the generated skill files without their frontmatter. */
export const loadCore = (skillsDir = SKILLS_DIR): string =>
  CORE_SKILLS.map((name) =>
    readFileSync(path.join(skillsDir, name, 'SKILL.md'), 'utf-8')
      .replace(SKILL_HEADER, '')
      .trim(),
  ).join('\n\n');

/**
 * Pi 1.2 makes the event a union on `messageType`, adding `custom` runs started by
 * `sendMessage(..., { triggerTurn: true })` that carry no user prompt. Every run needs the core,
 * so the handler reads only the fields both members share.
 */
type AgentStartEvent = Pick<BeforeAgentStartEvent, 'systemPrompt'> & {
  readonly messageType?: string;
};

/**
 * before_agent_start handler: the always-on core, the mode prompt, and root project
 * customization, read fresh each turn. Never throws: broken project files surface via notify
 * plus a STOP banner. See ADR-CORE-006 and ADR-CORE-037.
 */
export const createModePromptHandler = (
  state: MaestriaState,
  fs?: ProjectConfigFs,
  core: () => string = loadCore,
) => {
  let cached: string | undefined;
  const coreText = (): string => {
    cached ??= core();
    return cached;
  };
  return (event: AgentStartEvent, ctx?: ProjectPromptContext): BeforeAgentStartEventResult => {
    const parts: string[] = [event.systemPrompt, '', coreText(), ''];
    const loaded = tryLoadProjectSections(ctx, fs);
    if (loaded.errorMessage !== undefined) {
      return { systemPrompt: [...parts, formatProjectErrorBanner(loaded.errorMessage)].join('\n') };
    }
    if (state.mode !== null) {
      parts.push(
        getModePrompt(state.mode, COMMANDS_DIR),
        '',
        `The user has set workflow mode to "${state.mode}". ` +
          'Honor this mode throughout the session until changed via /command.',
        '',
      );
    }
    for (const section of loaded.sections) {
      parts.push(formatProjectSection(section), '');
    }
    return { systemPrompt: parts.join('\n') };
  };
};
