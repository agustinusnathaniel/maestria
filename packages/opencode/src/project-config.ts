import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';

/**
 * Project-root customization loader (OpenCode-local copy: this published
 * package must not depend on private @maestria/shared-pi). Mirrors the
 * Pi-family loader: root-only workflow then rules, absent/empty skipped,
 * present-but-unusable throws rel-only diagnostics; the throw propagates as
 * a failed model call. See ADR-CORE-006 and docs/runtime-support-matrix.md.
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
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'ENOENT';

const isSanitizedDiagnostic = (error: unknown): error is Error =>
  error instanceof Error && error.message.startsWith('[maestria] Project config');

/** Reject a present-but-unusable entry with a rel-only diagnostic. */
const assertFileKind = (rel: string, kind: ProjectEntryKind): void => {
  if (kind === 'directory') {
    throw new Error(`[maestria] Project config "${rel}" is a directory, expected a file`);
  }
  if (kind === 'other') {
    throw new Error(`[maestria] Project config "${rel}" is not a regular file`);
  }
};

/** Raw fs failures name only the rel file and kind; sanitized ones pass through. */
const sanitizeFsError = (rel: string, fallback: string, error: unknown): Error => {
  if (isSanitizedDiagnostic(error)) {
    return error;
  }
  return new Error(`[maestria] Project config "${rel}" ${fallback}`);
};

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

/** Load one file: missing/empty yields nothing, unusable throws rel-only. */
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
  assertFileKind(rel, kind);

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
  if (targetKind === 'missing') {
    throw new Error(`[maestria] Project config "${rel}" cannot be accessed`);
  }
  assertFileKind(rel, targetKind);
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

/** Read customization in order; missing/empty skipped, unusable throws. */
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
    // Absent root stays lexical so files report missing (skipped) instead of erroring.
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

/** Format one section; the header keeps subordinate status visible. */
export const formatProjectSection = (section: ProjectSection): string =>
  [
    `Project customization from ${section.rel} (subordinate guidance: it may replace configurable workflows but never waives safety, authorization, or host permissions):`,
    section.content,
  ].join('\n');

/** Merge paths without duplicating entries on repeat calls. */
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
