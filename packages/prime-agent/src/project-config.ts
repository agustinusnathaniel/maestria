// packages/prime-agent/src/project-config.ts
// Prime-local root project customization (no shared-pi import).
//
// Prime stays isolated by ADR-CORE-014: this module is a small local
// equivalent of the Pi/OMP shared helper, covering only the verified needs:
// deterministic file names and order, root scoping, and diagnostics. It
// imports only Node filesystem APIs plus the vendored type-only `./pi-api.js`.
//
// Scope contract:
// - Root-only: `<root>/.maestria/workflow.md` then `<root>/.maestria/rules.md`.
//   No ancestor scan, no nested inheritance, no `process.cwd` fallback. The
//   root is the host-selected session cwd (`ctx.cwd`), read live each turn.
// - Absent files are normal and leave the prompt unchanged; empty files carry
//   no instructions and are skipped. Additions, edits, and deletions apply on
//   the next turn: contents are never cached, persisted to session entries, or
//   duplicated into compaction state.
// - Present-but-unusable entries (directory, special file, unreadable,
//   unresolvable, resolving outside the root, or a link whose resolved
//   target is not a regular file) are errors. Diagnostics name
//   only the relative file and the failure kind; contents and absolute paths
//   never appear, and raw errors are never attached as `cause`. The host is
//   expected to swallow `before_agent_start` exceptions (Pi-lineage behavior;
//   unverified against a pinned Prime fork),
//   so callers must NOT throw to fail closed: surface via `ctx.ui.notify` plus
//   {@link formatProjectErrorBanner} in the returned system prompt.

import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';

/** Project workflow sequencing, loaded first. */
export const PROJECT_WORKFLOW_REL = '.maestria/workflow.md';
/** Project rules, loaded second. */
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
 * Missing files are skipped; empty files carry no instructions and are
 * skipped. Anything present but unusable throws with a diagnostic naming only
 * the relative file and the failure kind. The root itself is resolved through
 * symlinks, so a symlinked root still matches inside-root targets. Checks
 * observe the filesystem at call time; they are not an atomic snapshot.
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
 * Format one project section for system-prompt injection. The header keeps the
 * subordinate status visible at the point of use: project guidance may replace
 * configurable workflows but never waives safety, authorization, or host
 * permissions. The body is project-authored content, never executed.
 */
export const formatProjectSection = (section: ProjectSection): string =>
  [
    `Project customization from ${section.rel} (subordinate guidance: it may replace configurable workflows but never waives safety, authorization, or host permissions):`,
    section.content,
  ].join('\n');

/**
 * Build the fail-loud banner for a broken project customization. The host
 * swallows `before_agent_start` exceptions, so adapters surface this via
 * `ctx.ui.notify` and inject it into the system prompt with an explicit STOP
 * instruction instead of running with silently absent config.
 */
export const formatProjectErrorBanner = (message: string): string =>
  [
    'Project customization failed to load. STOP: do not execute the user request on potentially overridden configuration.',
    'Report this error to the user and wait for the project files to be fixed.',
    message,
  ].join('\n');
