// packages/core/scripts/lib/process-file.ts - Single-file transform pipeline

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { relative, dirname } from 'node:path';
import {
  stripFrontmatter,
  findAndReplace,
  stripSourceComment,
  serializeFrontmatter,
  normalizeLineEndings,
} from './transforms.js';
import { unifiedDiff } from './diff.js';
import { atomicWrite } from './file.js';
import type { ResolvedFileConfig } from './config.js';
import type { SyncFileResult } from './sync.js';
import { execFileSync } from 'node:child_process';

// ── Git provenance check ──

/**
 * Check that a synced output file wasn't modified without changing the
 * corresponding canonical source or sync config. Uses git to detect uncommitted changes.
 * Silently skips if not in a git repo or git is unavailable.
 */
function hasPorcelainChanges(repoCwd: string, filePath: string): boolean {
  const porcelain = execFileSync('git', ['status', '--porcelain', '--', filePath], {
    cwd: repoCwd,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
  return porcelain.length > 0;
}

function hasStagedChangesForFile(repoCwd: string, filePath: string): boolean {
  try {
    execFileSync('git', ['diff', '--cached', '--quiet', '--', filePath], {
      cwd: repoCwd,
      stdio: 'ignore',
    });
    return false;
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      (error as { status?: number }).status === 1
    ) {
      return true;
    }
    throw error;
  }
}

function isStagedOutputValid(
  repoCwd: string,
  outputPath: string,
  expectedContent: string,
): boolean {
  const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
    cwd: repoCwd,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
  const indexPath = relative(repoRoot, outputPath);
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
}

function checkProvenance(
  sourcePath: string,
  outputPath: string,
  expectedContent: string,
  configPath?: string,
): boolean {
  try {
    const repoCwd = dirname(outputPath);
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
    if (configPath && hasPorcelainChanges(repoCwd, configPath)) {
      return true;
    }
    return false;
  } catch {
    return true;
  }
}

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
function buildTransformedContent(raw: string, fileCfg: ResolvedFileConfig): string {
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
  const autoGenComment = `${fileCfg.autoGenComment || defaultComment}\n\n`;
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
}

async function handleExistingComparison(
  sourcePath: string,
  fileCfg: ResolvedFileConfig,
  opts: ProcessFileOpts,
  content: string,
  existingContent: string | null,
): Promise<SyncFileResult | null> {
  const { configPath, check, verbose, report, logger } = opts;
  if (existingContent !== content) {
    return null;
  }
  if (check && !checkProvenance(sourcePath, fileCfg.output, content, configPath)) {
    const relOutput = relative(process.cwd(), fileCfg.output);
    const relSource = relative(process.cwd(), sourcePath);
    if (verbose) {
      logger(
        `[check] Provenance violation: ${relOutput} was modified without changing ${relSource}`,
      );
    }
    return {
      source: sourcePath,
      output: fileCfg.output,
      status: 'error',
      error: `Provenance violation: ${relOutput} was modified without changing canonical source at ${relSource}`,
    };
  }
  if (verbose) {
    logger(`[${report}] Unchanged: ${relative(process.cwd(), fileCfg.output)}`);
  }
  return { source: sourcePath, output: fileCfg.output, status: 'unchanged' };
}

// oxlint-disable-next-line max-lines-per-function -- processFile orchestrates the single canonical transform pipeline (read → transform → dry-run/check/write) as a cohesive sequence; splitting would fragment the dispatch modes that share raw/content/existingContent state.
export async function processFile(
  sourcePath: string,
  fileCfg: ResolvedFileConfig,
  opts: ProcessFileOpts,
): Promise<SyncFileResult> {
  const { dryRun, check, diff, verbose, report, logger } = opts;
  try {
    const raw = await readFile(sourcePath, 'utf-8');
    const content = buildTransformedContent(raw, fileCfg);
    if (dryRun) {
      if (verbose) {
        logger(`[dry-run] Would write: ${relative(process.cwd(), fileCfg.output)}`);
      }
      return {
        source: sourcePath,
        output: fileCfg.output,
        status: 'dry-run',
        content: diff ? content : undefined,
      };
    }
    const existingContent = existsSync(fileCfg.output)
      ? normalizeLineEndings(await readFile(fileCfg.output, 'utf-8'))
      : null;
    const unchanged = await handleExistingComparison(
      sourcePath,
      fileCfg,
      opts,
      content,
      existingContent,
    );
    if (unchanged) {
      return unchanged;
    }
    if (check) {
      if (diff) {
        logger(unifiedDiff(fileCfg.output, fileCfg.output, existingContent ?? '', content));
      }
      if (verbose) {
        logger(`[check] Mismatch: ${relative(process.cwd(), fileCfg.output)}`);
      }
      return {
        source: sourcePath,
        output: fileCfg.output,
        status: 'error',
        error: 'Output differs from expected',
        content: diff ? content : undefined,
      };
    }
    await atomicWrite(fileCfg.output, content);
    if (diff) {
      logger(unifiedDiff(fileCfg.output, fileCfg.output, existingContent ?? '', content));
    }
    if (verbose) {
      logger(`[${report}] Written: ${relative(process.cwd(), fileCfg.output)}`);
    }
    return {
      source: sourcePath,
      output: fileCfg.output,
      status: 'written',
      content: diff ? content : undefined,
    };
  } catch (error) {
    return { source: sourcePath, output: fileCfg.output, status: 'error', error: String(error) };
  }
}
