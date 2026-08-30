/**
 * Private runtime-neutral shared mode mechanics.
 *
 * Pure TypeScript - no host SDKs, no filesystem APIs.
 * Consolidates the duplicated pure logic from:
 * - `packages/opencode/src/modes/index.ts`
 * - `packages/shared/pi/src/modes-core.ts`
 *
 * Consumers (OpenCode, shared-pi) delegate pure detection,
 * stripping, and mode-section extraction to this module while
 * keeping host-specific concerns (lazy file loading, session
 * state, command registration) locally.
 *
 * @module @maestria/shared-mode
 */

// ── Constants ──

export const MODE_KEYWORDS = ['fein', 'sonar', 'blitz'] as const;
export type ModeKeyword = (typeof MODE_KEYWORDS)[number];

/**
 * Backward-compatible alias used by OpenCode (`VALID_KEYWORDS`).
 */
export const VALID_KEYWORDS: readonly ModeKeyword[] = MODE_KEYWORDS;

export const MODE_MARKERS: Record<ModeKeyword, string> = {
  blitz: '[MODE: blitz]',
  fein: '[MODE: fein]',
  sonar: '[MODE: sonar]',
};

/**
 * Priority mapping for mode keyword restrictiveness.
 * Higher number = more restrictive = wins when multiple keywords are present.
 * fein (3): full pipeline with mandatory gates
 * sonar (2): research only, no code
 * blitz (1): fast implementation, skip optional ceremony; required review remains
 */
export const MODE_PRIORITY: Record<ModeKeyword, number> = {
  blitz: 1,
  fein: 3,
  sonar: 2,
};

// ── Types ──

/**
 * Result of pure mode detection (no prompt/marker).
 * Host wrappers add prompt/marker and stripped text as needed.
 */
export interface ModeDetectPure {
  mode: ModeKeyword;
  keyword: string;
  index: number;
}

// ── Pure helpers ──

/**
 * Regex matching fenced code blocks (```) and inline backtick spans (`).
 * Unclosed fenced blocks (``` without closing ```) are intentionally not
 * excluded - the regex requires matching fences. This is the accepted
 * false-positive behavior documented in ADR-OC-003.
 */
export const CODE_BLOCK_RE = /```[\s\S]*?```|`[^`]*`/gu;

export function findCodeBlockRanges(text: string): [number, number][] {
  const ranges: [number, number][] = [];
  let match: RegExpExecArray | null;
  // Reset lastIndex in case callers reuse the exported regex
  CODE_BLOCK_RE.lastIndex = 0;
  while ((match = CODE_BLOCK_RE.exec(text)) !== null) {
    ranges.push([match.index, match.index + match[0].length]);
  }
  return ranges;
}

export function isInRanges(index: number, ranges: [number, number][]): boolean {
  return ranges.some(([start, end]) => index >= start && index < end);
}

/**
 * Extract the `## MODE:` section from a command file's content.
 * Mirrors the logic in both original modules: find `## MODE:`, slice
 * from there, trim trailing whitespace, append a single newline; if
 * no marker is found, normalize trailing whitespace the same way.
 */
export function extractModeSection(content: string): string {
  const modeIdx = content.indexOf('## MODE:');
  if (modeIdx !== -1) {
    return `${content.slice(modeIdx).replace(/\s+$/u, '')}\n`;
  }
  return `${content.replace(/\s+$/u, '')}\n`;
}

function escapeRegExp(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function buildKeywordRegex(keyword: string): RegExp {
  return new RegExp(`\\b${escapeRegExp(keyword)}\\b`, 'giu');
}

function isModeKeyword(value: string): value is ModeKeyword {
  return (MODE_KEYWORDS as readonly string[]).includes(value);
}

export function getModeMarker(mode: string): string {
  if (isModeKeyword(mode)) {
    return MODE_MARKERS[mode];
  }
  return '';
}

// ── Detection ──

/**
 * Detect a workflow mode keyword in the given text.
 *
 * Rules (per ADR-OC-003):
 * - Word-boundary regex matching (`\bfein\b`, etc.), case-insensitive
 * - Most restrictive match wins (fein > sonar > blitz) regardless of position
 * - Disabled keywords (case-insensitive) are ignored
 * - Matches inside fenced code blocks (```) and inline backticks (`) are ignored
 * - Unclosed fences are not excluded (accepted false-positive)
 *
 * Returns the pure detection result (mode, matched keyword text, index) or null.
 */
export function detectMode(text: string, disabled?: Set<string>): ModeDetectPure | null {
  if (!text) {
    return null;
  }
  const codeRanges = findCodeBlockRanges(text);
  const normalizedDisabled = disabled
    ? new Set([...disabled].map((k) => k.toLowerCase()))
    : undefined;
  let best: ModeDetectPure | null = null;

  for (const keyword of MODE_KEYWORDS) {
    if (normalizedDisabled?.has(keyword)) {
      continue;
    }
    const regex = buildKeywordRegex(keyword);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      if (isInRanges(match.index, codeRanges)) {
        continue;
      }
      if (best === null || MODE_PRIORITY[keyword] > MODE_PRIORITY[best.mode]) {
        best = { index: match.index, keyword: match[0], mode: keyword };
      }
    }
  }

  return best;
}

/**
 * Remove the matched keyword from the text, cleaning up a trailing colon
 * and collapsing double spaces.
 *
 * Mirrors both originals: strip a leading colon and surrounding whitespace
 * after the keyword, then collapse double spaces and trim.
 */
export function stripKeyword(text: string, result: { index: number; keyword: string }): string {
  const before = text.slice(0, result.index);
  const after = text.slice(result.index + result.keyword.length);
  const cleaned = after.replace(/^:\s*/u, '');
  return (before + cleaned).replaceAll(/ {2,}/gu, ' ').trim();
}
