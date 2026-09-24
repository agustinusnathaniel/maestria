/**
 * Root project customization for Pi-family hosts (no host SDK): root-only
 * workflow then rules; absent/empty skipped, unusable throws rel-only
 * diagnostics (callers: banner plus notify). See ADR-CORE-006.
 *
 * @module
 */

import { loadProjectSections } from '@maestria/shared-project-config';
import type { ProjectConfigFs, ProjectSection } from '@maestria/shared-project-config';

export {
  formatProjectErrorBanner,
  formatProjectSection,
  loadProjectSections,
  PROJECT_CONFIG_REL_PATHS,
  PROJECT_RULES_REL,
  PROJECT_WORKFLOW_REL,
} from '@maestria/shared-project-config';
export type {
  ProjectConfigFs,
  ProjectEntryKind,
  ProjectSection,
} from '@maestria/shared-project-config';

/** Minimal host surface handlers read: session cwd plus notify. */
export interface ProjectPromptContext {
  cwd?: unknown;
  ui?: { notify?: (message: string) => void };
}

export const readProjectRoot = (ctx: ProjectPromptContext | undefined): string | undefined =>
  typeof ctx?.cwd === 'string' && ctx.cwd !== '' ? ctx.cwd : undefined;

const notifyProjectError = (ctx: ProjectPromptContext | undefined, message: string): void => {
  try {
    ctx?.ui?.notify?.(message);
  } catch {
    // Notify is best-effort UI surfacing; the banner below is authoritative.
  }
};

/** Load for a handler context without throwing; unusable yields a banner message. */
export const tryLoadProjectSections = (
  ctx: ProjectPromptContext | undefined,
  fs?: ProjectConfigFs,
): { sections: ProjectSection[]; errorMessage: string | undefined } => {
  const root = readProjectRoot(ctx);
  if (root === undefined) {
    return { errorMessage: undefined, sections: [] };
  }
  try {
    const sections = loadProjectSections(root, fs);
    return { errorMessage: undefined, sections };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    notifyProjectError(ctx, message);
    return { errorMessage: message, sections: [] };
  }
};
