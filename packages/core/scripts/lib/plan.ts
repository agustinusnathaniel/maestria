// packages/core/scripts/lib/plan.ts - Ordered sync plan resolution
//
// Resolves the single ordered list of files a run will process: primary source
// files in walk order, then secondary config entries in declaration order.
// Anchor validation and the processing loop both consume this plan, so their
// resolution cannot drift. Verbose diagnostics are resolved here too, so the
// reporting loop never re-derives source filtering or origin labels.

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
  /** Diagnostic label for verbose output; secondary entries name their origin. */
  logLabel: string;
  origin: 'primary' | 'secondary';
}

// ── Plan Resolution ──

/**
 * Resolve the ordered plan for one run. `report` labels the verbose notes.
 * Throws a single ConfigError naming every config entry missing from the source
 * dir and its parent before any file is processed. Verbose notes are returned
 * in source walk order for the caller to emit before processing.
 */
export const resolveSyncPlan = (
  config: ResolvedSyncConfig,
  sourceFiles: string[],
  report: string,
): { entries: SyncPlanEntry[]; notes: string[] } => {
  const entries: SyncPlanEntry[] = [];
  const notes: string[] = [];
  const matchedFilenames = new Set<string>();

  for (const relPath of sourceFiles) {
    if (!relPath.endsWith('.md')) {
      notes.push(`[${report}] Skipping non-.md file: ${relPath}`);
      continue;
    }
    const filename = path.basename(relPath);
    matchedFilenames.add(filename);
    const explicit = config.files[filename];
    if (explicit === undefined) {
      notes.push(`[${report}] No config for ${relPath}, using defaults`);
    }
    entries.push({
      fileCfg: explicit ?? resolveSourceFile(config, filename),
      label: relPath,
      logLabel: relPath,
      origin: 'primary',
      sourcePath: path.resolve(config.source, relPath),
    });
  }

  const secondarySourceDir = path.dirname(config.source);
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
    entries.push({
      fileCfg,
      label: filename,
      logLabel: `secondary source ${filename}`,
      origin: 'secondary',
      sourcePath,
    });
  }
  if (missing.length > 0) {
    throw new ConfigError(
      `Config entries not found in source or secondary dir: ${missing.join(', ')}`,
    );
  }

  return { entries, notes };
};
