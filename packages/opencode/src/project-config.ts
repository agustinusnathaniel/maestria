import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';

/**
 * Project-root customization loader (OpenCode-local copy; this published
 * package must not depend on private @maestria/shared-pi).
 *
 * Contract mirrors the Pi-family loader: root-only workflow then rules, no
 * ancestor scan; absent or empty files skipped; present-but-unusable entries
 * throw sanitized diagnostics (relative path plus kind only). Read-error
 * signal differs by host: here the throw propagates as a failed model call.
 * Full contract: ADR-CORE-006 plus docs/runtime-support-matrix.md.
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
 * Prefers the SDK project worktree, then the instance worktree, then the
 * session directory. Worktree fields holding the "/" sentinel (host-reported
 * for projects without version control) are skipped; the session directory
 * is accepted as-is so a genuine "/" open still resolves.
 */
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
 * Load one project file: missing and empty entries yield nothing,
 * present-but-unusable entries throw a sanitized diagnostic. The resolved
 * link target is reclassified before reading, so special targets fail here.
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
 * Read project customization at call time, in deterministic order. Missing
 * or empty files are skipped; present-but-unusable entries throw a
 * sanitized diagnostic naming only the relative file and kind. The root is
 * resolved through symlinks; checks are not an atomic snapshot.
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
 * the subordinate status visible at the point of use; the body is
 * project-authored content, never executed.
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
