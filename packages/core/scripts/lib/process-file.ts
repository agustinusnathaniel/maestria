// packages/core/scripts/lib/process-file.ts — Single-file transform pipeline

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { relative } from 'node:path';
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

// ── Types ──

export interface ProcessFileOpts {
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
 * This is the single canonical transform — called from both the main source
 * loop and the secondary source loop, eliminating the previous duplication.
 */
export async function processFile(
  sourcePath: string,
  fileCfg: ResolvedFileConfig,
  opts: ProcessFileOpts,
): Promise<SyncFileResult> {
  const { dryRun, check, diff, verbose, report, logger } = opts;

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
    const autoGenComment = `<!-- Auto-generated from @maestria/core. Do not edit directly.
     Edit the canonical file at packages/core/agent-directives/ instead. -->\n\n`;

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
