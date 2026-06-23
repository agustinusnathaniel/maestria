// packages/core/scripts/lib/sync.ts — Core sync pipeline

import { readFile, writeFile, readdir, mkdir, rename, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, relative, dirname, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { createTwoFilesPatch } from 'diff';
import type { ResolvedSyncConfig, ResolvedFileConfig } from './config.js';
import {
  stripFrontmatter,
  findAndReplace,
  stripSourceComment,
  serializeFrontmatter,
  normalizeLineEndings,
} from './transforms.js';

// ── Diff ──

function unifiedDiff(
  oldPath: string,
  newPath: string,
  oldContent: string,
  newContent: string,
): string {
  try {
    return createTwoFilesPatch(oldPath, newPath, oldContent, newContent);
  } catch {
    return '[diff generation failed]\n';
  }
}

// ── Sync Pipeline ──

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

async function walkDir(dir: string): Promise<string[]> {
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

  for (const relPath of sourceFiles) {
    if (!relPath.endsWith('.md')) {
      if (verbose) {
        logger(`[${report}] Skipping non-.md file: ${relPath}`);
      }
      continue;
    }

    const sourceAbs = resolve(config.source, relPath);
    const filename = basename(relPath);

    const fileCfg = config.files[filename];
    if (!fileCfg && verbose) {
      logger(`[${report}] No config for ${relPath}, using defaults`);
    }

    const resolved: ResolvedFileConfig = fileCfg ?? {
      output: config.output
        ? resolve(config.output, filename)
        : resolve(config.configDir, filename),
      stripFrontmatter: false,
      replace: [],
      prepend: '',
      append: '',
    };

    generatedOutputs.add(resolved.output);

    try {
      let content = normalizeLineEndings(await readFile(sourceAbs, 'utf-8'));

      // ----- Transform pipeline -----

      // 1. Strip frontmatter
      if (resolved.stripFrontmatter) {
        content = stripFrontmatter(content);
      }

      // 2. Find/replace
      if (resolved.replace.length > 0) {
        content = findAndReplace(content, resolved.replace);
      }

      // 3. Strip any existing source comment (idempotency)
      content = stripSourceComment(content);

      // 4. Prepend
      if (resolved.prepend) {
        content = resolved.prepend + content;
      }

      // 5. Append
      if (resolved.append) {
        content = content + resolved.append;
      }

      // 6. Serialize frontmatter
      const autoGenComment = `<!-- Auto-generated from @maestria/core. Do not edit directly.
     Edit the canonical file at packages/core/agent-directives/ instead. -->\n\n`;

      if (resolved.frontmatter !== undefined) {
        const fm = serializeFrontmatter(resolved.frontmatter);
        content = fm + '\n' + autoGenComment + content;
      } else if (resolved.prepend) {
        // Insert auto-generated comment after prepend content
        content =
          content.slice(0, resolved.prepend.length) +
          '\n' +
          autoGenComment +
          content.slice(resolved.prepend.length);
      } else {
        content = autoGenComment + content;
      }

      content = normalizeLineEndings(content);

      // ----- Write or check -----

      if (dryRun) {
        results.push({
          source: sourceAbs,
          output: resolved.output,
          status: 'dry-run',
          content: diff ? content : undefined,
        });
        if (verbose) {
          logger(`[dry-run] Would write: ${relative(process.cwd(), resolved.output)}`);
        }
        continue;
      }

      let existingContent: string | null = null;
      if (existsSync(resolved.output)) {
        existingContent = normalizeLineEndings(await readFile(resolved.output, 'utf-8'));
      }

      if (existingContent === content) {
        results.push({ source: sourceAbs, output: resolved.output, status: 'unchanged' });
        if (verbose) {
          logger(`[${report}] Unchanged: ${relative(process.cwd(), resolved.output)}`);
        }
        continue;
      }

      if (check) {
        if (diff) {
          const patch = unifiedDiff(
            resolved.output,
            resolved.output,
            existingContent ?? '',
            content,
          );
          logger(patch);
        }
        results.push({
          source: sourceAbs,
          output: resolved.output,
          status: 'error',
          error: 'Output differs from expected',
          content: diff ? content : undefined,
        });
        if (verbose) {
          logger(`[check] Mismatch: ${relative(process.cwd(), resolved.output)}`);
        }
        continue;
      }

      // Write
      await mkdir(dirname(resolved.output), { recursive: true });
      const tmpPath =
        resolved.output +
        '.tmp.' +
        createHash('md5').update(resolved.output).digest('hex').slice(0, 8);
      await writeFile(tmpPath, content, 'utf-8');
      await rename(tmpPath, resolved.output);

      results.push({
        source: sourceAbs,
        output: resolved.output,
        status: 'written',
        content: diff ? content : undefined,
      });

      if (diff) {
        const patch = unifiedDiff(resolved.output, resolved.output, existingContent ?? '', content);
        logger(patch);
      }

      if (verbose) {
        logger(`[${report}] Written: ${relative(process.cwd(), resolved.output)}`);
      }
    } catch (err) {
      results.push({
        source: sourceAbs,
        output: resolved.output,
        status: 'error',
        error: String(err),
      });
      logger(`[${report}] Error processing ${relPath}: ${err}`);
    }
  }

  // Auto-clean: remove files in output dir that weren't generated
  if (config.output && existsSync(config.output)) {
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
  }

  return results;
}
