import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';

/**
 * Project-root customization files, in deterministic load order.
 * Workflow sequencing first, then project rules, matching the canonical
 * orchestrator guidance.
 */
export const PROJECT_WORKFLOW_REL = '.maestria/workflow.md';
export const PROJECT_RULES_REL = '.maestria/rules.md';
export const PROJECT_CONFIG_REL_PATHS = [PROJECT_WORKFLOW_REL, PROJECT_RULES_REL] as const;

export interface ProjectRootInput {
  directory?: string;
  project?: { worktree?: string };
  worktree?: string;
}

export type ProjectEntryKind = 'missing' | 'file' | 'directory' | 'other';

export interface ProjectSection {
  content: string;
  rel: string;
}

export interface ProjectConfigFs {
  kindOf: (candidate: string) => ProjectEntryKind;
  readFile: (candidate: string) => string;
  resolveLink: (candidate: string) => string;
}

const isNonEmpty = (value: unknown): value is string => typeof value === 'string' && value !== '';

const isEnoent = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: unknown }).code === 'ENOENT';

const isSanitizedDiagnostic = (error: unknown): error is Error =>
  error instanceof Error && error.message.startsWith('[maestria] Project config');

/**
 * Wrap a filesystem failure in a diagnostic naming only the relative file
 * and the failure kind. Already-sanitized diagnostics pass through
 * untouched; raw errors (which may carry absolute paths or file contents)
 * are replaced, and never attached as `cause`, so host error serialization
 * cannot leak them.
 */
const sanitizeFsError = (rel: string, fallback: string, error: unknown): Error => {
  if (isSanitizedDiagnostic(error)) {
    return error;
  }
  return new Error(`[maestria] Project config "${rel}" ${fallback}`);
};

/**
 * The host reports "/" as the worktree for projects without version control
 * (pinned host v1.18.31: `packages/opencode/src/project/project.ts` assigns
 * the filesystem root when no git repo is discovered, and the instance
 * boundary helper in `project/instance-context.ts` skips "/" for the same
 * reason). "/" is therefore a sentinel, not a project root.
 */
const isRootSentinel = (value: string): boolean => value === '/';

/**
 * Resolve the project root from the host plugin input.
 * Prefers the SDK project worktree (the version-control root for git
 * projects), then the instance worktree checkout, then the session
 * directory, which is always the genuine open directory. Worktree fields
 * holding the "/" sentinel are skipped; the session directory is accepted
 * as-is so a genuine "/" open directory still resolves instead of being
 * rejected.
 */
export const resolveProjectRoot = (input: ProjectRootInput): string | undefined => {
  const { project, worktree, directory } = input;
  if (isNonEmpty(project?.worktree) && !isRootSentinel(project.worktree)) {
    return project.worktree;
  }
  if (isNonEmpty(worktree) && !isRootSentinel(worktree)) {
    return worktree;
  }
  if (isNonEmpty(directory)) {
    return directory;
  }
  return undefined;
};

const defaultFs: ProjectConfigFs = {
  kindOf: (candidate) => {
    try {
      const stat = lstatSync(candidate);
      if (stat.isDirectory()) {
        return 'directory';
      }
      if (stat.isFile() || stat.isSymbolicLink()) {
        return 'file';
      }
      return 'other';
    } catch (error) {
      if (isEnoent(error)) {
        return 'missing';
      }
      throw error;
    }
  },
  readFile: (candidate) => readFileSync(candidate, 'utf-8'),
  resolveLink: (candidate) => realpathSync(candidate),
};

const escapesRoot = (root: string, resolved: string): boolean => {
  const relative = path.relative(root, resolved);
  return relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative);
};

/**
 * Load one project file: missing and empty entries yield nothing, anything
 * present but unusable throws a sanitized diagnostic. The resolved target is
 * reclassified before reading (the resolved path contains no symlinks, so
 * the check observes the link target itself), so a symlink to a FIFO,
 * directory, or other special file fails here instead of blocking on open
 * or misreading.
 */
const loadOneSection = (
  normalizedRoot: string,
  rel: string,
  fs: ProjectConfigFs,
): ProjectSection | undefined => {
  const candidate = path.join(normalizedRoot, rel);
  let kind: ProjectEntryKind;
  try {
    kind = fs.kindOf(candidate);
  } catch (error) {
    throw sanitizeFsError(rel, 'cannot be accessed', error);
  }
  if (kind === 'missing') {
    return undefined;
  }
  if (kind === 'directory') {
    throw new Error(`[maestria] Project config "${rel}" is a directory, expected a file`);
  }
  if (kind === 'other') {
    throw new Error(`[maestria] Project config "${rel}" is not a regular file`);
  }

  let resolved: string;
  try {
    resolved = fs.resolveLink(candidate);
  } catch (error) {
    throw sanitizeFsError(rel, 'cannot be resolved', error);
  }
  if (escapesRoot(normalizedRoot, resolved)) {
    throw new Error(`[maestria] Project config "${rel}" resolves outside the project root`);
  }
  let targetKind: ProjectEntryKind;
  try {
    targetKind = fs.kindOf(resolved);
  } catch (error) {
    throw sanitizeFsError(rel, 'cannot be accessed', error);
  }
  if (targetKind === 'directory') {
    throw new Error(`[maestria] Project config "${rel}" is a directory, expected a file`);
  }
  if (targetKind === 'missing') {
    // The target vanished between resolve and stat: fail loudly instead
    // of silently skipping a present-but-unusable file.
    throw new Error(`[maestria] Project config "${rel}" cannot be accessed`);
  }
  if (targetKind === 'other') {
    throw new Error(`[maestria] Project config "${rel}" is not a regular file`);
  }
  let content: string;
  try {
    content = fs.readFile(candidate);
  } catch (error) {
    throw sanitizeFsError(rel, 'exists but cannot be read', error);
  }
  if (content === '') {
    return undefined;
  }
  return { content, rel };
};

/**
 * Read project customization contents at call time, in deterministic order.
 * Missing files are normal and skipped; empty files carry no instructions
 * and are skipped. Anything present but unusable (directory, special file,
 * unreadable, unresolvable, resolving outside the root, or a link whose
 * resolved target is not a regular file) throws, so a broken customization
 * fails the model call instead of running with silently absent config.
 * Error messages name only the relative file and the failure kind; file
 * contents and absolute paths never appear, and raw errors are never
 * attached as `cause`. The root itself is resolved through symlinks, so a
 * symlinked root still matches inside-root targets. Checks observe the
 * filesystem at call time; they are not an atomic snapshot.
 */
export const loadProjectSections = (
  root: string,
  fs: ProjectConfigFs = defaultFs,
): ProjectSection[] => {
  if (!isNonEmpty(root)) {
    return [];
  }
  let normalizedRoot: string;
  try {
    normalizedRoot = realpathSync(root);
  } catch (error) {
    if (!isEnoent(error)) {
      // oxlint-disable-next-line preserve-caught-error -- the diagnostics contract forbids attaching the raw error (absolute paths may leak through host error serialization); the kind is preserved in the message.
      throw new Error('[maestria] Project config root cannot be accessed');
    }
    // Absent root: keep the lexical path so the kind check below reports
    // each file missing (normal, skipped) instead of erroring.
    normalizedRoot = path.resolve(root);
  }
  const sections: ProjectSection[] = [];

  for (const rel of PROJECT_CONFIG_REL_PATHS) {
    const section = loadOneSection(normalizedRoot, rel, fs);
    if (section !== undefined) {
      sections.push(section);
    }
  }

  return sections;
};

/**
 * Format one project section for system-prompt injection. The header keeps
 * the subordinate status visible at the point of use: project guidance may
 * replace configurable workflows but never waives safety, authorization, or
 * host permissions. The body is project-authored content, never executed.
 */
export const formatProjectSection = (section: ProjectSection): string =>
  [
    `Project customization from ${section.rel} (subordinate guidance: it may replace configurable workflows but never waives safety, authorization, or host permissions):`,
    section.content,
  ].join('\n');

/**
 * Append instruction paths without duplicating entries on repeat calls,
 * preserving user-configured order.
 */
export const appendInstructions = (
  instructions: string[] | undefined,
  paths: readonly string[],
): string[] => {
  const merged = [...(instructions ?? [])];
  for (const entry of paths) {
    if (!merged.includes(entry)) {
      merged.push(entry);
    }
  }
  return merged;
};
