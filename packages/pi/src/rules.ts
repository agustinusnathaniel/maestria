import type {
  BeforeAgentStartEvent,
  BeforeAgentStartEventResult,
} from '@earendil-works/pi-coding-agent';
import {
  formatProjectErrorBanner,
  formatProjectSection,
  loadProjectSections,
} from '@maestria/shared-project-config';
import type { ProjectConfigFs, ProjectSection } from '@maestria/shared-project-config';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { getModePrompt } from '@/modes.js';
import type { MaestriaState } from '@/state.js';

const SKILLS_DIR = path.resolve(import.meta.dirname, '../skills');

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

/** Minimal host surface handlers read: session cwd plus notify. */
interface ProjectPromptContext {
  cwd?: unknown;
  ui?: { notify?: (message: string) => void };
}

/**
 * Root project customization from the session cwd, re-read every turn. An unusable file never
 * throws: it is reported through notify (best-effort) and returned as a banner message.
 */
const tryLoadProjectSections = (
  ctx: ProjectPromptContext | undefined,
  fs?: ProjectConfigFs,
): { sections: ProjectSection[]; errorMessage: string | undefined } => {
  const root = typeof ctx?.cwd === 'string' && ctx.cwd !== '' ? ctx.cwd : undefined;
  if (root === undefined) {
    return { errorMessage: undefined, sections: [] };
  }
  try {
    return { errorMessage: undefined, sections: loadProjectSections(root, fs) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    try {
      ctx?.ui?.notify?.(message);
    } catch {
      // Notify is best-effort UI surfacing; the banner is authoritative.
    }
    return { errorMessage: message, sections: [] };
  }
};

const CORE_UNAVAILABLE =
  'STOP: the maestria always-on rules could not be loaded from the installed package. Tell the user to reinstall @maestria/pi, and wait.';

/**
 * before_agent_start handler: the always-on core (read once), then the mode prompt and root
 * project customization (read fresh each turn). Never throws: the host swallows handler errors,
 * which would drop this run's whole addition, so an unreadable core or project file surfaces via
 * notify plus a STOP banner instead. See ADR-CORE-006 and ADR-CORE-037.
 */
export const createModePromptHandler = (
  state: MaestriaState,
  fs?: ProjectConfigFs,
  core: () => string = loadCore,
) => {
  let cached: string | undefined;
  const coreText = (ctx?: ProjectPromptContext): string => {
    if (cached === undefined) {
      try {
        cached = core();
      } catch {
        ctx?.ui?.notify?.(
          '[maestria] The always-on rules could not be loaded; reinstall @maestria/pi.',
        );
        return CORE_UNAVAILABLE;
      }
    }
    return cached;
  };
  return (event: AgentStartEvent, ctx?: ProjectPromptContext): BeforeAgentStartEventResult => {
    const parts: string[] = [event.systemPrompt, '', coreText(ctx), ''];
    const loaded = tryLoadProjectSections(ctx, fs);
    if (loaded.errorMessage !== undefined) {
      return { systemPrompt: [...parts, formatProjectErrorBanner(loaded.errorMessage)].join('\n') };
    }
    if (state.mode !== null) {
      parts.push(
        getModePrompt(state.mode),
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
