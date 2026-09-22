// Root-only project customization (no shared-pi import per ADR-CORE-014
// isolation). Workflow then rules; absent/empty skipped, unusable throws
// rel-only diagnostics (see ADR-CORE-006).

import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';

export const PROJECT_WORKFLOW_REL = '.maestria/workflow.md';
export const PROJECT_RULES_REL = '.maestria/rules.md';
/** Deterministic load order: workflow sequencing first, then project rules. */
export const PROJECT_CONFIG_REL_PATHS = [PROJECT_WORKFLOW_REL, PROJECT_RULES_REL] as const;

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

/** Raw fs failures name only the rel file and kind; sanitized ones pass through. */
const sanitizeFsError = (rel: string, fallback: string, error: unknown): Error => {
  if (isSanitizedDiagnostic(error)) {
    return error;
  }
  return new Error(`[maestria] Project config "${rel}" ${fallback}`);
};

/** Reject a present-but-unusable entry with a rel-only diagnostic. */
const assertFileKind = (rel: string, kind: ProjectEntryKind): void => {
  if (kind === 'directory') {
    throw new Error(`[maestria] Project config "${rel}" is a directory, expected a file`);
  }
  if (kind === 'other') {
    throw new Error(`[maestria] Project config "${rel}" is not a regular file`);
  }
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

/** Format one section; the header keeps subordinate status visible. */
export const formatProjectSection = (section: ProjectSection): string =>
  [
    `Project customization from ${section.rel} (subordinate guidance: it may replace configurable workflows but never waives safety, authorization, or host permissions):`,
    section.content,
  ].join('\n');

/** Fail-loud banner with STOP; callers surface it via notify plus prompt. */
export const formatProjectErrorBanner = (message: string): string =>
  [
    'Project customization failed to load. STOP: do not execute the user request on potentially overridden configuration.',
    'Report this error to the user and wait for the project files to be fixed.',
    message,
  ].join('\n');
