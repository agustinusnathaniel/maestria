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
function checkProvenance(
  sourcePath: string,
  outputPath: string,
  expectedContent: string,
  configPath?: string,
): boolean {
  try {
    // git operations must run within the repo; derive cwd from output path
    const repoCwd = dirname(outputPath);

    const hasChanges = (filePath: string): boolean => {
      // A single porcelain call covers staged (`M `), unstaged (` M`), and
      // untracked (`??`) changes. execFileSync passes the path as an argument
      // (no shell), so a path containing shell metacharacters cannot inject
      // commands — the previous execSync string interpolation could.
      const porcelain = execFileSync('git', ['status', '--porcelain', '--', filePath], {
        cwd: repoCwd,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
      return porcelain.length > 0;
    };

    const hasStagedChanges = (filePath: string): boolean => {
      try {
        execFileSync('git', ['diff', '--cached', '--quiet', '--', filePath], {
          cwd: repoCwd,
          stdio: 'ignore',
        });
        return false;
      } catch (err) {
        if (
          typeof err === 'object' &&
          err !== null &&
          'status' in err &&
          (err as { status?: number }).status === 1
        ) {
          return true;
        }
        throw err;
      }
    };

    const outputChanged = hasChanges(outputPath);
    if (!outputChanged) return true; // No uncommitted changes to output file - fine

    if (hasStagedChanges(outputPath)) {
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
        // Git confirmed a staged change, so a missing or unreadable index entry
        // is itself a provenance violation (for example, a staged deletion).
        return false;
      }

      // A staged output must itself be generated from the current expected content.
      // Source/config changes cannot authorize an unrelated staged hand edit.
      return stagedContent === expectedContent;
    }

    const sourceChanged = hasChanges(sourcePath);
    if (sourceChanged) return true; // Both changed - legitimate workflow

    if (configPath && hasChanges(configPath)) return true; // Config changed - legitimate workflow

    // Output changed but source didn't - provenance violation
    return false;
  } catch {
    return true; // Not a git repo or git unavailable - skip check
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
export async function processFile(
  sourcePath: string,
  fileCfg: ResolvedFileConfig,
  opts: ProcessFileOpts,
): Promise<SyncFileResult> {
  const { configPath, dryRun, check, diff, verbose, report, logger } = opts;

  try {
    let content = normalizeLineEndings(await readFile(sourcePath, 'utf-8'));

    // 1. Strip frontmatter
    if (fileCfg.stripFrontmatter) {
      content = stripFrontmatter(content);
    }

    // 2. Find/replace
    if (fileCfg.replace.length > 0) {
      content = findAndReplace(content, fileCfg.replace);
    }

    // 3. Strip any existing source comment (idempotency)
    content = stripSourceComment(content);

    // 4. Prepend
    if (fileCfg.prepend) {
      content = fileCfg.prepend + content;
    }

    // 5. Append
    if (fileCfg.append) {
      content = content + fileCfg.append;
    }

    // 6. Auto-generated header with optional frontmatter
    const defaultComment = `<!-- Auto-generated from @maestria/core. Do not edit directly.
     Edit the canonical file at packages/core/agent-directives/ instead. -->`;
    const autoGenComment = (fileCfg.autoGenComment || defaultComment) + '\n\n';

    if (fileCfg.frontmatter !== undefined) {
      const fm = serializeFrontmatter(fileCfg.frontmatter);
      content = fm + '\n' + autoGenComment + content;
    } else if (fileCfg.prepend) {
      // Insert auto-generated comment after prepend content
      content =
        content.slice(0, fileCfg.prepend.length) +
        '\n' +
        autoGenComment +
        content.slice(fileCfg.prepend.length);
    } else {
      content = autoGenComment + content;
    }

    content = normalizeLineEndings(content);

    // 7. Ensure trailing newline (basic text file convention, no external tool needed)
    if (!content.endsWith('\n')) {
      content += '\n';
    }

    // ── Mode dispatch ──

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

    let existingContent: string | null = null;
    if (existsSync(fileCfg.output)) {
      existingContent = normalizeLineEndings(await readFile(fileCfg.output, 'utf-8'));
    }

    if (existingContent === content) {
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

    if (check) {
      if (diff) {
        const patch = unifiedDiff(fileCfg.output, fileCfg.output, existingContent ?? '', content);
        logger(patch);
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

    // Write
    await atomicWrite(fileCfg.output, content);

    if (diff) {
      const patch = unifiedDiff(fileCfg.output, fileCfg.output, existingContent ?? '', content);
      logger(patch);
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
  } catch (err) {
    return {
      source: sourcePath,
      output: fileCfg.output,
      status: 'error',
      error: String(err),
    };
  }
}
