import { existsSync } from 'node:fs';
import path from 'node:path';

import {
  formatProjectErrorBanner,
  formatProjectSection,
  loadProjectSections,
} from '@maestria/shared-project-config';

/** The nearest ancestor holding `.git`, else `cwd`: the project root DeepSeek Harness's skill provider uses. */
export const projectRoot = (cwd: string): string => {
  for (let dir = path.resolve(cwd); ; dir = path.dirname(dir)) {
    if (existsSync(path.join(dir, '.git'))) {
      return dir;
    }
    if (path.dirname(dir) === dir) {
      return path.resolve(cwd);
    }
  }
};

/**
 * Project-root `.maestria/workflow.md` then `.maestria/rules.md`, read on every assembly so edits
 * apply on the next step. An unusable file becomes a STOP banner rather than a throw, which would
 * fail the whole prompt assembly.
 */
export const projectContext = (cwd: string): string => {
  try {
    return loadProjectSections(projectRoot(cwd)).map(formatProjectSection).join('\n\n');
  } catch (error) {
    return formatProjectErrorBanner(error instanceof Error ? error.message : String(error));
  }
};
