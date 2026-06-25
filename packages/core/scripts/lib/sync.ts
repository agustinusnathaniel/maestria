// packages/core/scripts/lib/sync.ts - Core sync orchestration
//
// Orchestrates the sync pipeline: walks source directories, applies
// transforms via processFile(), resolves secondary sources for files
// not in the primary source dir, and auto-cleans stale output files.

import { existsSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import type { ResolvedSyncConfig, ResolvedFileConfig } from './config.js';
import { walkDir, autoClean } from './file.js';
import { processFile } from './process-file.js';

// ── Public Types ──

export interface SyncFileResult {
  source: string;
  output: string;
  status: 'written' | 'unchanged' | 'removed' | 'dry-run' | 'error';
  error?: string;
  content?: string;
}

export interface SyncOptions {
  config: ResolvedSyncConfig;
  dryRun?: boolean;
  check?: boolean;
  diff?: boolean;
  verbose?: boolean;
  log?: (msg: string) => void;
}

// ── Orchestration ──

export async function runSync(options: SyncOptions): Promise<SyncFileResult[]> {
  const { config, dryRun, check, diff, verbose, log } = options;
  const logger = log ?? console.log;
  const results: SyncFileResult[] = [];
  const generatedOutputs = new Set<string>();
  const report = dryRun ? (check ? 'check' : 'dry-run') : 'sync';

  if (!existsSync(config.source)) {
    logger(`[${report}] Source directory not found: ${config.source}`);
    return results;
  }

  const sourceFiles = await walkDir(config.source);
  const matchedFiles = new Set<string>();

  // ── Primary source loop ──

  for (const relPath of sourceFiles) {
    if (!relPath.endsWith('.md')) {
      if (verbose) {
        logger(`[${report}] Skipping non-.md file: ${relPath}`);
      }
      continue;
    }

    const sourceAbs = resolve(config.source, relPath);
    const filename = basename(relPath);
    matchedFiles.add(filename);

    const fileCfg = config.files[filename];
    const isExplicit = filename in config.files;

    let resolved: ResolvedFileConfig;
    if (isExplicit) {
      // File was in config.files - resolveFileConfig already merged defaults
      resolved = fileCfg;
    } else {
      // File wasn't in config.files - apply default merging here
      if (verbose) {
        logger(`[${report}] No config for ${relPath}, using defaults`);
      }
      resolved = {
        output: config.output
          ? resolve(config.output, filename)
          : resolve(config.configDir, filename),
        stripFrontmatter: config.default?.stripFrontmatter ?? false,
        replace: [...(config.default?.replace ?? [])],
        prepend: config.default?.prepend ?? '',
        append: config.default?.append ?? '',
        frontmatter: config.default?.frontmatter,
      };
    }

    generatedOutputs.add(resolved.output);

    const result = await processFile(sourceAbs, resolved, {
      dryRun,
      check,
      diff,
      verbose,
      report,
      logger,
    });

    results.push(result);

    if (result.status === 'error' && verbose) {
      logger(`[${report}] Error processing ${relPath}: ${result.error}`);
    }
  }

  // ── Secondary source loop ──
  // Process config.files entries not found in source dir (e.g. rules.md from parent of source)

  const secondarySourceDir = dirname(config.source);
  for (const [filename, fileCfg] of Object.entries(config.files)) {
    if (matchedFiles.has(filename)) continue;

    const secondaryAbs = resolve(secondarySourceDir, filename);
    if (!existsSync(secondaryAbs)) {
      if (verbose) {
        logger(`[${report}] Config entry "${filename}" not found in source or secondary dir`);
      }
      continue;
    }

    generatedOutputs.add(fileCfg.output);

    const result = await processFile(secondaryAbs, fileCfg, {
      dryRun,
      check,
      diff,
      verbose,
      report,
      logger,
    });

    results.push(result);

    if (result.status === 'error' && verbose) {
      logger(`[${report}] Error processing secondary source ${filename}: ${result.error}`);
    }
  }

  // ── Auto-clean: remove stale output files ──

  const cleanResults = await autoClean(config, generatedOutputs, {
    dryRun,
    check,
    verbose,
    report,
    logger,
  });
  results.push(...cleanResults);

  return results;
}
