// packages/core/scripts/lib/file.ts - File I/O utilities

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { ResolvedSyncConfig } from './config.js';
import type { SyncFileResult } from './sync.js';

// ── Directory walker ──

export const walkDir = async (dir: string): Promise<string[]> => {
  const entries: string[] = [];

  const walk = async (current: string): Promise<void> => {
    const dirEntries = await readdir(current, { withFileTypes: true });
    await Promise.all(
      dirEntries.map(async (entry) => {
        const fullPath = path.resolve(current, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else {
          entries.push(path.relative(dir, fullPath));
        }
      }),
    );
  };

  await walk(dir);
  return entries.toSorted();
};

// ── Atomic write (tmp + rename) ──

export const atomicWrite = async (filePath: string, content: string): Promise<void> => {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp.${createHash('md5').update(filePath).digest('hex').slice(0, 8)}`;
  await writeFile(tmpPath, content, 'utf-8');
  await rename(tmpPath, filePath);
};

// ── Auto-clean stale output files ──

export interface AutoCleanOpts {
  dryRun?: boolean;
  check?: boolean;
  verbose?: boolean;
  report: string;
  logger: (msg: string) => void;
}

const removeStaleFile = async (
  previous: Promise<void>,
  filePath: string,
  opts: AutoCleanOpts,
  results: SyncFileResult[],
): Promise<void> => {
  await previous;
  await unlink(filePath);
  results.push({ output: filePath, source: '', status: 'removed' });
  if (opts.verbose === true) {
    opts.logger(`[${opts.report}] Removed stale: ${path.relative(process.cwd(), filePath)}`);
  }
};

export const autoClean = async (
  config: ResolvedSyncConfig,
  generatedOutputs: Set<string>,
  opts: AutoCleanOpts,
): Promise<SyncFileResult[]> => {
  const { dryRun, check, verbose, report, logger } = opts;
  const results: SyncFileResult[] = [];

  if (!config.output || !existsSync(config.output)) {
    return results;
  }

  const outputFiles = await walkDir(config.output);
  let cleanup = Promise.resolve();

  for (const relOutPath of outputFiles) {
    const absOutPath = path.resolve(config.output, relOutPath);

    // Skip files that match preserve patterns
    if (
      config.preserve.length > 0 &&
      config.preserve.some((p) => relOutPath === p || relOutPath.endsWith(`/${p}`))
    ) {
      if (verbose === true) {
        logger(`[${report}] Preserved: ${path.relative(process.cwd(), absOutPath)}`);
      }
      continue;
    }

    if (!generatedOutputs.has(absOutPath)) {
      if (dryRun === true) {
        results.push({ output: absOutPath, source: '', status: 'dry-run' });
        if (verbose === true) {
          logger(`[dry-run] Would remove stale: ${path.relative(process.cwd(), absOutPath)}`);
        }
      } else if (check === true) {
        results.push({ output: absOutPath, source: '', status: 'removed' });
        if (verbose === true) {
          logger(`[check] Would remove stale: ${path.relative(process.cwd(), absOutPath)}`);
        }
      } else {
        cleanup = removeStaleFile(cleanup, absOutPath, opts, results);
      }
    }
  }

  await cleanup;
  return results;
};
