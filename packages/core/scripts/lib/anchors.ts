// packages/core/scripts/lib/anchors.ts - Anchor liveness validation
//
// Replays the resolved sync plan's replace ops in order to prove every anchor
// still matches. Validation runs before any processing so a dead anchor fails
// the run instead of silently no-oping a transform.

import { readFile } from 'node:fs/promises';

import type { ResolvedFileConfig, ResolvedReplaceOp, ResolvedSyncConfig } from './config.js';
import type { SyncPlanEntry } from './plan.js';
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
  content: string;
  label: string;
  replace: ResolvedReplaceOp[];
}

const prepareContent = (raw: string, fileCfg: ResolvedFileConfig): string => {
  const normalized = normalizeLineEndings(raw);
  return fileCfg.stripFrontmatter ? stripFrontmatter(normalized) : normalized;
};

const collectTargets = async (plan: SyncPlanEntry[]): Promise<AnchorTarget[]> => {
  const targets = await Promise.all(
    plan.map(async (entry) => {
      const raw = await readFile(entry.sourcePath, 'utf-8');
      return {
        content: prepareContent(raw, entry.fileCfg),
        label: entry.label,
        replace: entry.fileCfg.replace,
      };
    }),
  );
  return targets;
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
  plan: SyncPlanEntry[],
): Promise<AnchorReport> => {
  const targets = await collectTargets(plan);

  const applied = targets.map((target) => ({
    matches: applyReplaceOps(target.content, target.replace).matches,
    target,
  }));

  const defaultTotals = new Map<string, number>();
  for (const { matches, target } of applied) {
    for (const [index, op] of target.replace.entries()) {
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
    for (const [index, op] of target.replace.entries()) {
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
