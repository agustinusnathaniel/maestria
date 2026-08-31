// packages/core/scripts/lib/process-file.ts - Single-file transform pipeline

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { ResolvedFileConfig } from './config.js';
import { unifiedDiff } from './diff.js';
import { atomicWrite } from './file.js';
import type { SyncFileResult } from './sync.js';
import {
  findAndReplace,
  normalizeLineEndings,
  serializeFrontmatter,
  stripFrontmatter,
  stripSourceComment,
} from './transforms.js';

// ── Git provenance check ──

/**
 * Check that a synced output file wasn't modified without changing the
 * corresponding canonical source or sync config. Uses git to detect uncommitted changes.
 * Silently skips if not in a git repo or git is unavailable.
 */
const hasPorcelainChanges = (repoCwd: string, filePath: string): boolean => {
  const porcelain = execFileSync('git', ['status', '--porcelain', '--', filePath], {
    cwd: repoCwd,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
  return porcelain.length > 0;
};

const hasStagedChangesForFile = (repoCwd: string, filePath: string): boolean => {
  try {
    execFileSync('git', ['diff', '--cached', '--quiet', '--', filePath], {
      cwd: repoCwd,
      stdio: 'ignore',
    });
    return false;
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'status' in error && error.status === 1) {
      return true;
    }
    throw error;
  }
};

const isStagedOutputValid = (
  repoCwd: string,
  outputPath: string,
  expectedContent: string,
): boolean => {
  const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
    cwd: repoCwd,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
  const indexPath = path.relative(repoRoot, outputPath);
  let stagedContent: string;
  try {
    stagedContent = execFileSync('git', ['show', `:${indexPath}`], {
      cwd: repoRoot,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return false;
  }
  return stagedContent === expectedContent;
};

const checkProvenance = (
  sourcePath: string,
  outputPath: string,
  expectedContent: string,
  configPath?: string,
): boolean => {
  try {
    const repoCwd = path.dirname(outputPath);
    const outputChanged = hasPorcelainChanges(repoCwd, outputPath);
    if (!outputChanged) {
      return true;
    }
    if (hasStagedChangesForFile(repoCwd, outputPath)) {
      return isStagedOutputValid(repoCwd, outputPath, expectedContent);
    }
    if (hasPorcelainChanges(repoCwd, sourcePath)) {
      return true;
    }
    if (
      configPath !== undefined &&
      configPath !== null &&
      configPath !== '' &&
      hasPorcelainChanges(repoCwd, configPath)
    ) {
      return true;
    }
    return false;
  } catch {
    return true;
  }
};

// ── Types ──

export interface ProcessFileOpts {
  configPath?: string;
  dryRun?: boolean;
  check?: boolean;
  diff?: boolean;
  verbose?: boolean;
  report: string;
  logger: (msg: string) => void;
}

// ── Transform pipeline ──

/**
 * Read a source file, apply the full transform pipeline (strip frontmatter →
 * find/replace → strip source comment → prepend → append → auto-gen header),
 * then dispatch according to mode (dry-run, check, write).
 *
 * This is the single canonical transform - called from both the main source
 * loop and the secondary source loop, eliminating the previous duplication.
 */
const buildTransformedContent = (raw: string, fileCfg: ResolvedFileConfig): string => {
  let content = normalizeLineEndings(raw);
  if (fileCfg.stripFrontmatter) {
    content = stripFrontmatter(content);
  }
  if (fileCfg.replace.length > 0) {
    content = findAndReplace(content, fileCfg.replace);
  }
  content = stripSourceComment(content);
  if (fileCfg.prepend) {
    content = fileCfg.prepend + content;
  }
  if (fileCfg.append) {
    content += fileCfg.append;
  }
  const defaultComment = `<!-- Auto-generated from @maestria/core. Do not edit directly.
     Edit the canonical file at packages/core/agent-directives/ instead. -->`;
  const configuredComment = fileCfg.autoGenComment;
  const autoGenComment = `${
    configuredComment === undefined || configuredComment === '' ? defaultComment : configuredComment
  }\n\n`;
  if (fileCfg.frontmatter !== undefined) {
    const fm = serializeFrontmatter(fileCfg.frontmatter);
    content = `${fm}\n${autoGenComment}${content}`;
  } else if (fileCfg.prepend) {
    content = `${content.slice(0, fileCfg.prepend.length)}\n${
      autoGenComment
    }${content.slice(fileCfg.prepend.length)}`;
  } else {
    content = autoGenComment + content;
  }
  content = normalizeLineEndings(content);
  if (!content.endsWith('\n')) {
    content += '\n';
  }
  return content;
};

const handleExistingComparison = (
  sourcePath: string,
  fileCfg: ResolvedFileConfig,
  opts: ProcessFileOpts,
  content: string,
  existingContent: string | null,
): SyncFileResult | null => {
  const { configPath, check, verbose, report, logger } = opts;
  if (existingContent !== content) {
    return null;
  }
  if (check === true && !checkProvenance(sourcePath, fileCfg.output, content, configPath)) {
    const relOutput = path.relative(process.cwd(), fileCfg.output);
    const relSource = path.relative(process.cwd(), sourcePath);
    if (verbose === true) {
      logger(
        `[check] Provenance violation: ${relOutput} was modified without changing ${relSource}`,
      );
    }
    return {
      error: `Provenance violation: ${relOutput} was modified without changing canonical source at ${relSource}`,
      output: fileCfg.output,
      source: sourcePath,
      status: 'error',
    };
  }
  if (verbose === true) {
    logger(`[${report}] Unchanged: ${path.relative(process.cwd(), fileCfg.output)}`);
  }
  return { output: fileCfg.output, source: sourcePath, status: 'unchanged' };
};

// oxlint-disable-next-line max-lines-per-function -- processFile orchestrates the single canonical transform pipeline (read → transform → dry-run/check/write) as a cohesive sequence; splitting would fragment the dispatch modes that share raw/content/existingContent state.
export const processFile = async (
  sourcePath: string,
  fileCfg: ResolvedFileConfig,
  opts: ProcessFileOpts,
): Promise<SyncFileResult> => {
  const { dryRun, check, diff, verbose, report, logger } = opts;
  try {
    const raw = await readFile(sourcePath, 'utf-8');
    const content = buildTransformedContent(raw, fileCfg);
    if (dryRun === true) {
      if (verbose === true) {
        logger(`[dry-run] Would write: ${path.relative(process.cwd(), fileCfg.output)}`);
      }
      return {
        content: diff === true ? content : undefined,
        output: fileCfg.output,
        source: sourcePath,
        status: 'dry-run',
      };
    }
    const existingContent = existsSync(fileCfg.output)
      ? normalizeLineEndings(await readFile(fileCfg.output, 'utf-8'))
      : null;
    const unchanged = handleExistingComparison(sourcePath, fileCfg, opts, content, existingContent);
    if (unchanged !== null && unchanged !== undefined) {
      return unchanged;
    }
    if (check === true) {
      if (diff === true) {
        logger(unifiedDiff(fileCfg.output, fileCfg.output, existingContent ?? '', content));
      }
      if (verbose === true) {
        logger(`[check] Mismatch: ${path.relative(process.cwd(), fileCfg.output)}`);
      }
      return {
        content: diff === true ? content : undefined,
        error: 'Output differs from expected',
        output: fileCfg.output,
        source: sourcePath,
        status: 'error',
      };
    }
    await atomicWrite(fileCfg.output, content);
    if (diff === true) {
      logger(unifiedDiff(fileCfg.output, fileCfg.output, existingContent ?? '', content));
    }
    if (verbose === true) {
      logger(`[${report}] Written: ${path.relative(process.cwd(), fileCfg.output)}`);
    }
    return {
      content: diff === true ? content : undefined,
      output: fileCfg.output,
      source: sourcePath,
      status: 'written',
    };
  } catch (error) {
    return { error: String(error), output: fileCfg.output, source: sourcePath, status: 'error' };
  }
};
