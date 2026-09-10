// packages/core/scripts/lib/anchors.ts - Anchor liveness validation
//
// Mirrors the engine's file sweep (primary .md files, then secondary config
// entries) and replays each resolved file's replace ops in order to prove every
// anchor still matches. Validation runs before any processing so a dead anchor
// fails the run instead of silently no-oping a transform.

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { ResolvedFileConfig, ResolvedReplaceOp, ResolvedSyncConfig } from './config.js';
import { resolveSourceFile } from './config.js';
import { applyReplaceOps, normalizeLineEndings, stripFrontmatter } from './transforms.js';

// ── Public Types ──

export type AnchorViolationReason = 'empty-from' | 'identity' | 'no-match';

export interface AnchorViolation {
  configPath: string;
  /** Source-relative path for primary files, config key for secondary sources, or "all files". */
  file: string;
  scope: ResolvedReplaceOp['scope'];
  from: string;
  to: string;
  matches: number;
  reason: AnchorViolationReason;
}

export interface AnchorReport {
  violations: AnchorViolation[];
}

const ALL_FILES = 'all files';

// ── Internal Helpers ──

interface AnchorTarget {
  label: string;
  config: ResolvedFileConfig;
  content: string;
}

const prepareContent = (raw: string, fileCfg: ResolvedFileConfig): string => {
  const normalized = normalizeLineEndings(raw);
  return fileCfg.stripFrontmatter ? stripFrontmatter(normalized) : normalized;
};

const collectPrimaryTargets = async (
  config: ResolvedSyncConfig,
  sourceFiles: string[],
  matchedFiles: Set<string>,
): Promise<AnchorTarget[]> => {
  const markdownFiles = sourceFiles.filter((relPath) => relPath.endsWith('.md'));
  for (const relPath of markdownFiles) {
    matchedFiles.add(path.basename(relPath));
  }
  return await Promise.all(
    markdownFiles.map(async (relPath) => {
      const fileCfg = resolveSourceFile(config, path.basename(relPath));
      const raw = await readFile(path.resolve(config.source, relPath), 'utf-8');
      return { config: fileCfg, content: prepareContent(raw, fileCfg), label: relPath };
    }),
  );
};

const collectSecondaryTargets = async (
  config: ResolvedSyncConfig,
  matchedFiles: Set<string>,
): Promise<AnchorTarget[]> => {
  const secondarySourceDir = path.dirname(config.source);
  const entries = Object.entries(config.files).flatMap(([filename, fileCfg]) => {
    if (matchedFiles.has(filename)) {
      return [];
    }
    const absPath = path.resolve(secondarySourceDir, filename);
    return existsSync(absPath) ? [{ absPath, fileCfg, filename }] : [];
  });
  return await Promise.all(
    entries.map(async ({ absPath, fileCfg, filename }) => {
      const raw = await readFile(absPath, 'utf-8');
      return { config: fileCfg, content: prepareContent(raw, fileCfg), label: filename };
    }),
  );
};

const opKey = (op: ResolvedReplaceOp): string => `${op.from}\u0000${op.to}`;

const violationReason = (op: ResolvedReplaceOp, matches: number): AnchorViolationReason | null => {
  if (op.from === '') {
    return 'empty-from';
  }
  if (op.from === op.to) {
    return 'identity';
  }
  return matches === 0 ? 'no-match' : null;
};

const toViolation = (
  configPath: string,
  file: string,
  op: ResolvedReplaceOp,
  matches: number,
  reason: AnchorViolationReason,
): AnchorViolation => ({
  configPath,
  file,
  from: op.from,
  matches,
  reason,
  scope: op.scope,
  to: op.to,
});

// ── Validation ──

export const validateAnchors = async (
  config: ResolvedSyncConfig,
  sourceFiles: string[],
): Promise<AnchorReport> => {
  const matchedFiles = new Set<string>();
  const targets: AnchorTarget[] = [
    ...(await collectPrimaryTargets(config, sourceFiles, matchedFiles)),
    ...(await collectSecondaryTargets(config, matchedFiles)),
  ];

  const applied = targets.map((target) => ({
    matches: applyReplaceOps(target.content, target.config.replace).matches,
    target,
  }));

  const defaultTotals = new Map<string, number>();
  for (const { matches, target } of applied) {
    for (const [index, op] of target.config.replace.entries()) {
      if (op.scope !== 'default') {
        continue;
      }
      const key = opKey(op);
      defaultTotals.set(key, (defaultTotals.get(key) ?? 0) + (matches[index] ?? 0));
    }
  }

  const violations: AnchorViolation[] = [];
  const reportedDefaults = new Set<string>();
  for (const { matches, target } of applied) {
    for (const [index, op] of target.config.replace.entries()) {
      const count = matches[index] ?? 0;
      if (op.scope === 'default') {
        const key = opKey(op);
        if (reportedDefaults.has(key)) {
          continue;
        }
        reportedDefaults.add(key);
        const total = defaultTotals.get(key) ?? 0;
        const reason = violationReason(op, total);
        if (reason !== null) {
          violations.push(toViolation(config.configPath, ALL_FILES, op, total, reason));
        }
        continue;
      }
      const reason = violationReason(op, count);
      if (reason !== null) {
        violations.push(toViolation(config.configPath, target.label, op, count, reason));
      }
    }
  }

  return { violations };
};

const REASON_HINTS: Record<AnchorViolationReason, string> = {
  'empty-from': ' [empty from]',
  identity: ' [from equals to]',
  'no-match': '',
};

export const formatAnchorViolations = (configPath: string, report: AnchorReport): string => {
  const lines = report.violations.map((violation) => {
    const matchLabel = `${violation.matches} match${violation.matches === 1 ? '' : 'es'}`;
    return `  - [${violation.scope}] "${violation.from}" -> "${violation.to}" in ${violation.file}: ${matchLabel}${REASON_HINTS[violation.reason]}`;
  });
  return [
    `Anchor validation failed for ${configPath} (${report.violations.length} violation(s)):`,
    ...lines,
  ].join('\n');
};
