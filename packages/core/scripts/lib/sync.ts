// packages/core/scripts/lib/sync.ts - Core sync orchestration
//
// Orchestrates the sync pipeline: resolves one ordered file plan, validates
// replace anchors against it, applies transforms via processFile(), and
// auto-cleans stale output files.

import { existsSync } from 'node:fs';

import { formatAnchorViolations, validateAnchors } from './anchors.js';
import type { ResolvedSyncConfig } from './config.js';
import { ConfigError } from './config.js';
import { autoClean, walkDir } from './file.js';
import type { SyncPlanEntry } from './plan.js';
import { resolveSyncPlan } from './plan.js';
import type { ProcessFileOpts } from './process-file.js';
import { processFile } from './process-file.js';

// ── Public Types ──

export interface SyncFileResult {
  source: string;
  output: string;
  status: 'written' | 'unchanged' | 'removed' | 'dry-run' | 'error';
  error?: string;
}

export interface SyncOptions {
  config: ResolvedSyncConfig;
  dryRun?: boolean;
  check?: boolean;
  diff?: boolean;
  verbose?: boolean;
}

// ── Orchestration ──

const processPlanEntry = async (
  entry: SyncPlanEntry,
  opts: ProcessFileOpts,
  generatedOutputs: Set<string>,
  results: SyncFileResult[],
): Promise<void> => {
  generatedOutputs.add(entry.fileCfg.output);
  const result = await processFile(entry.sourcePath, entry.fileCfg, opts);
  results.push(result);
  if (result.status === 'error' && opts.verbose === true) {
    opts.logger(`[${opts.report}] Error processing ${entry.logLabel}: ${result.error}`);
  }
};

export const runSync = async (options: SyncOptions): Promise<SyncFileResult[]> => {
  const { config, dryRun, check, diff, verbose } = options;
  const logger = console.log;
  const results: SyncFileResult[] = [];
  const generatedOutputs = new Set<string>();
  let report = 'sync';
  if (check === true) {
    report = 'check';
  } else if (dryRun === true) {
    report = 'dry-run';
  }
  if (!existsSync(config.source)) {
    throw new ConfigError(`Source directory not found: ${config.source}`);
  }
  const sourceFiles = await walkDir(config.source);
  const { entries, notes } = resolveSyncPlan(config, sourceFiles, report);
  const anchorReport = await validateAnchors(config, entries);
  if (anchorReport.violations.length > 0) {
    throw new ConfigError(formatAnchorViolations(config.configPath, anchorReport));
  }
  if (verbose === true) {
    for (const note of notes) {
      logger(note);
    }
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
  for (const entry of entries) {
    // oxlint-disable-next-line no-await-in-loop -- sequential processing keeps result order deterministic.
    await processPlanEntry(entry, processOpts, generatedOutputs, results);
  }
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
