// packages/core/scripts/lib/sync.ts - Core sync orchestration
//
// Orchestrates the sync pipeline: walks source directories, applies
// transforms via processFile(), resolves secondary sources for files
// not in the primary source dir, and auto-cleans stale output files.

import { existsSync } from 'node:fs';
import path from 'node:path';

import type { ResolvedFileConfig, ResolvedSyncConfig } from './config.js';
import { autoClean, walkDir } from './file.js';
import { processFile } from './process-file.js';
import type { ProcessFileOpts } from './process-file.js';

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

const processSourceFile = async (
  sourcePath: string,
  fileCfg: ResolvedFileConfig,
  opts: ProcessFileOpts,
  generatedOutputs: Set<string>,
  results: SyncFileResult[],
  label: string,
): Promise<void> => {
  generatedOutputs.add(fileCfg.output);
  const result = await processFile(sourcePath, fileCfg, opts);
  results.push(result);
  if (result.status === 'error' && opts.verbose === true) {
    opts.logger(`[${opts.report}] Error processing ${label}: ${result.error}`);
  }
};

const processInSequence = async (
  previous: Promise<void>,
  task: () => Promise<void>,
): Promise<void> => {
  await previous;
  await task();
};

// ── Orchestration ──

const processPrimarySources = async (
  config: ResolvedSyncConfig,
  sourceFiles: string[],
  opts: ProcessFileOpts,
  generatedOutputs: Set<string>,
  results: SyncFileResult[],
  matchedFiles: Set<string>,
): Promise<void> => {
  const { dryRun, check, diff, verbose, report, logger } = opts;
  let processing = Promise.resolve();
  for (const relPath of sourceFiles) {
    if (!relPath.endsWith('.md')) {
      if (verbose === true) {
        logger(`[${report}] Skipping non-.md file: ${relPath}`);
      }
      continue;
    }
    const sourceAbs = path.resolve(config.source, relPath);
    const filename = path.basename(relPath);
    matchedFiles.add(filename);
    const fileCfg = config.files[filename];
    const isExplicit = filename in config.files;
    const resolved: ResolvedFileConfig = isExplicit
      ? fileCfg
      : {
          append: config.default?.append ?? '',
          frontmatter: config.default?.frontmatter,
          output: config.output
            ? path.resolve(config.output, filename)
            : path.resolve(config.configDir, filename),
          prepend: config.default?.prepend ?? '',
          replace: [...(config.default?.replace ?? [])],
          stripFrontmatter: config.default?.stripFrontmatter ?? false,
        };
    if (!isExplicit && verbose === true) {
      logger(`[${report}] No config for ${relPath}, using defaults`);
    }
    const processOpts: ProcessFileOpts = {
      check,
      configPath: config.configPath,
      diff,
      dryRun,
      logger,
      report,
      verbose,
    };
    processing = processInSequence(processing, async () => {
      await processSourceFile(sourceAbs, resolved, processOpts, generatedOutputs, results, relPath);
    });
  }
  await processing;
};

const processSecondarySources = async (
  config: ResolvedSyncConfig,
  opts: ProcessFileOpts,
  generatedOutputs: Set<string>,
  results: SyncFileResult[],
  matchedFiles: Set<string>,
): Promise<void> => {
  const { dryRun, check, diff, verbose, report, logger } = opts;
  let processing = Promise.resolve();
  const secondarySourceDir = path.dirname(config.source);
  for (const [filename, fileCfg] of Object.entries(config.files)) {
    if (matchedFiles.has(filename)) {
      continue;
    }
    const secondaryAbs = path.resolve(secondarySourceDir, filename);
    if (!existsSync(secondaryAbs)) {
      if (verbose === true) {
        logger(`[${report}] Config entry "${filename}" not found in source or secondary dir`);
      }
      continue;
    }
    const processOpts: ProcessFileOpts = {
      check,
      configPath: config.configPath,
      diff,
      dryRun,
      logger,
      report,
      verbose,
    };
    processing = processInSequence(processing, async () => {
      await processSourceFile(
        secondaryAbs,
        fileCfg,
        processOpts,
        generatedOutputs,
        results,
        `secondary source ${filename}`,
      );
    });
  }
  await processing;
};

export const runSync = async (options: SyncOptions): Promise<SyncFileResult[]> => {
  const { config, dryRun, check, diff, verbose, log } = options;
  const logger = log ?? console.log;
  const results: SyncFileResult[] = [];
  const generatedOutputs = new Set<string>();
  let report = 'sync';
  if (dryRun === true) {
    report = check === true ? 'check' : 'dry-run';
  }
  if (!existsSync(config.source)) {
    logger(`[${report}] Source directory not found: ${config.source}`);
    return results;
  }
  const sourceFiles = await walkDir(config.source);
  const matchedFiles = new Set<string>();
  await processPrimarySources(
    config,
    sourceFiles,
    { check, diff, dryRun, logger, report, verbose },
    generatedOutputs,
    results,
    matchedFiles,
  );
  await processSecondarySources(
    config,
    { check, diff, dryRun, logger, report, verbose },
    generatedOutputs,
    results,
    matchedFiles,
  );
  const cleanResults = await autoClean(config, generatedOutputs, {
    check,
    dryRun,
    logger,
    report,
    verbose,
  });
  results.push(...cleanResults);
  return results;
};
