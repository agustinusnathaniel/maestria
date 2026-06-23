// packages/core/scripts/lib/file.ts — File I/O utilities

import { readdir, writeFile, rename, unlink, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import type { ResolvedSyncConfig } from './config.js';
import type { SyncFileResult } from './sync.js';

// ── Directory walker ──

export async function walkDir(dir: string): Promise<string[]> {
  const entries: string[] = [];

  async function walk(current: string) {
    const dirEntries = await readdir(current, { withFileTypes: true });
    for (const entry of dirEntries) {
      const fullPath = resolve(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else {
        entries.push(relative(dir, fullPath));
      }
    }
  }

  await walk(dir);
  return entries.sort();
}

// ── Atomic write (tmp + rename) ──

export async function atomicWrite(filePath: string, content: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const tmpPath = filePath + '.tmp.' + createHash('md5').update(filePath).digest('hex').slice(0, 8);
  await writeFile(tmpPath, content, 'utf-8');
  await rename(tmpPath, filePath);
}

// ── Auto-clean stale output files ──

export interface AutoCleanOpts {
  dryRun?: boolean;
  check?: boolean;
  verbose?: boolean;
  report: string;
  logger: (msg: string) => void;
}

export async function autoClean(
  config: ResolvedSyncConfig,
  generatedOutputs: Set<string>,
  opts: AutoCleanOpts,
): Promise<SyncFileResult[]> {
  const { dryRun, check, verbose, report, logger } = opts;
  const results: SyncFileResult[] = [];

  if (!config.output || !existsSync(config.output)) {
    return results;
  }

  const outputFiles = await walkDir(config.output);

  for (const relOutPath of outputFiles) {
    const absOutPath = resolve(config.output, relOutPath);

    // Skip files that match preserve patterns
    if (
      config.preserve.length > 0 &&
      config.preserve.some((p) => relOutPath === p || relOutPath.endsWith('/' + p))
    ) {
      if (verbose) {
        logger(`[${report}] Preserved: ${relative(process.cwd(), absOutPath)}`);
      }
      continue;
    }

    if (!generatedOutputs.has(absOutPath)) {
      if (dryRun) {
        results.push({ source: '', output: absOutPath, status: 'dry-run' });
        if (verbose) {
          logger(`[dry-run] Would remove stale: ${relative(process.cwd(), absOutPath)}`);
        }
      } else if (check) {
        results.push({ source: '', output: absOutPath, status: 'removed' });
        if (verbose) {
          logger(`[check] Would remove stale: ${relative(process.cwd(), absOutPath)}`);
        }
      } else {
        await unlink(absOutPath);
        results.push({ source: '', output: absOutPath, status: 'removed' });
        if (verbose) {
          logger(`[${report}] Removed stale: ${relative(process.cwd(), absOutPath)}`);
        }
      }
    }
  }

  return results;
}
