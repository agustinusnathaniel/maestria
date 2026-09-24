export {
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

export interface ProjectRootInput {
  directory?: string;
  project?: { worktree?: string };
  worktree?: string;
}

const isNonEmpty = (value: unknown): value is string => typeof value === 'string' && value !== '';

/** "/" is a host sentinel for projects without version control, not a root. */
const isRootSentinel = (value: string): boolean => value === '/';

/** Prefer SDK project worktree, then instance worktree, then session dir. */
export const resolveProjectRoot = (input: ProjectRootInput): string | undefined => {
  const { project, worktree, directory } = input;
  for (const candidate of [project?.worktree, worktree]) {
    if (isNonEmpty(candidate) && !isRootSentinel(candidate)) {
      return candidate;
    }
  }
  if (isNonEmpty(directory)) {
    return directory;
  }
  return undefined;
};
