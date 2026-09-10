// packages/core/scripts/lib/plan.ts - Ordered sync plan resolution
//
// Resolves the single ordered list of files a run will process: primary source
// files in walk order, then secondary config entries in declaration order.
// Anchor validation and the processing loop both consume this plan, so their
// resolution cannot drift.

import { existsSync } from 'node:fs';
import path from 'node:path';

import type { ResolvedFileConfig, ResolvedSyncConfig } from './config.js';
import { ConfigError, resolveSourceFile } from './config.js';

// ── Public Types ──

export interface SyncPlanEntry {
  sourcePath: string;
  fileCfg: ResolvedFileConfig;
  /** Source-relative path for primary files, config key for secondary sources. */
  label: string;
  origin: 'primary' | 'secondary';
}

// ── Plan Resolution ──

const resolvePrimaryEntries = (
  config: ResolvedSyncConfig,
  sourceFiles: string[],
): SyncPlanEntry[] => {
  const entries: SyncPlanEntry[] = [];
  for (const relPath of sourceFiles) {
    if (!relPath.endsWith('.md')) {
      continue;
    }
    entries.push({
      fileCfg: resolveSourceFile(config, path.basename(relPath)),
      label: relPath,
      origin: 'primary',
      sourcePath: path.resolve(config.source, relPath),
    });
  }
  return entries;
};

const resolveSecondaryEntries = (
  config: ResolvedSyncConfig,
  matchedFilenames: Set<string>,
): SyncPlanEntry[] => {
  const secondarySourceDir = path.dirname(config.source);
  const entries: SyncPlanEntry[] = [];
  const missing: string[] = [];
  for (const [filename, fileCfg] of Object.entries(config.files)) {
    if (matchedFilenames.has(filename)) {
      continue;
    }
    const sourcePath = path.resolve(secondarySourceDir, filename);
    if (!existsSync(sourcePath)) {
      missing.push(filename);
      continue;
    }
    entries.push({ fileCfg, label: filename, origin: 'secondary', sourcePath });
  }
  if (missing.length > 0) {
    throw new ConfigError(
      `Config entries not found in source or secondary dir: ${missing.join(', ')}`,
    );
  }
  return entries;
};

/**
 * Resolve the ordered plan for one run. Throws a single ConfigError naming every
 * config entry missing from the source dir and its parent before any file is
 * processed.
 */
export const resolveSyncPlan = (
  config: ResolvedSyncConfig,
  sourceFiles: string[],
): SyncPlanEntry[] => {
  const primary = resolvePrimaryEntries(config, sourceFiles);
  const matchedFilenames = new Set(primary.map((entry) => path.basename(entry.sourcePath)));
  return [...primary, ...resolveSecondaryEntries(config, matchedFilenames)];
};
