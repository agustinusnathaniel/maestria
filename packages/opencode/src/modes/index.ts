import { escapeRegExp } from "es-toolkit";
import { MODE_PROMPTS, MODE_MARKERS, VALID_KEYWORDS } from "./prompts.js";
import type { ModeKeyword, ModeResult } from "./types.js";

/**
 * Priority mapping for mode keyword restrictiveness.
 * Higher number = more restrictive = wins when multiple keywords are present.
 * fein (3): full pipeline with mandatory gates
 * sonar (2): research only, no code
 * blitz (1): fast implementation, skip all gates
 */
const MODE_PRIORITY: Record<ModeKeyword, number> = {
  fein: 3,
  sonar: 2,
  blitz: 1,
};

/**
 * Regex matching fenced code blocks (```) and inline backtick spans (`).
 * Used to exclude keyword matches inside code spans.
 */
// Note: Unclosed fenced code blocks (``` without closing ```) are not
// excluded — the regex requires matching fences. This is an accepted
// false-positive risk (see ADR-008 consequences).
const CODE_BLOCK_RE = /```[\s\S]*?```|`[^`]*`/g;

/**
 * Find ranges of code blocks and inline code spans in text.
 * Returns [start, end) positions. Keywords inside these ranges
 * are ignored during detection.
 */
function findAllCodeBlockRanges(text: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  let match: RegExpExecArray | null;
  while ((match = CODE_BLOCK_RE.exec(text)) !== null) {
    ranges.push([match.index, match.index + match[0].length]);
  }
  return ranges;
}

function isInRanges(index: number, ranges: Array<[number, number]>): boolean {
  return ranges.some(([start, end]) => index >= start && index < end);
}

/**
 * Build a regex pattern for word-boundary matching of the given keyword.
 *
 * The pattern uses `\b` word boundaries to ensure we match whole words only,
 * and is case-insensitive so `Fein`, `FEIN`, `fein` all match.
 */
function buildKeywordRegex(keyword: string): RegExp {
  return new RegExp(`\\b${escapeRegExp(keyword)}\\b`, "gi");
}

/**
 * Detect a workflow mode keyword in the given text.
 *
 * Detection rules (per ADR-008):
 * - Word-boundary regex matching (`\bfein\b`, `\bsonar\b`, `\bblitz\b`)
 * - Most restrictive match wins (fein > sonar > blitz)
 * - Case-insensitive
 * - Disabled keywords are ignored
 * - Matches inside fenced code blocks (```) and inline backticks (`) are ignored
 *
 * @param text The user message to scan.
 * @param disabled Optional set of disabled mode keywords (lowercase).
 * @returns A `ModeResult` if a keyword was detected, or `null`.
 */
export function detectMode(text: string, disabled?: Set<string>): ModeResult | null {
  const codeRanges = findAllCodeBlockRanges(text);
  // Normalize disabled keywords to lowercase for case-insensitive comparison
  const normalizedDisabled = disabled
    ? new Set(Array.from(disabled).map((k) => k.toLowerCase()))
    : undefined;
  let bestMatch: { keyword: string; index: number; mode: ModeKeyword } | null = null;

  for (const keyword of VALID_KEYWORDS) {
    if (normalizedDisabled?.has(keyword)) continue;

    const regex = buildKeywordRegex(keyword);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      if (isInRanges(match.index, codeRanges)) continue;
      // Most-restrictive wins: prefer higher-priority mode over position
      if (bestMatch === null || MODE_PRIORITY[keyword] > MODE_PRIORITY[bestMatch.mode]) {
        bestMatch = {
          keyword: match[0],
          index: match.index,
          mode: keyword,
        };
      }
    }
  }

  if (bestMatch === null) return null;

  return {
    mode: bestMatch.mode,
    keyword: bestMatch.keyword,
    index: bestMatch.index,
    prompt: MODE_PROMPTS[bestMatch.mode],
    marker: MODE_MARKERS[bestMatch.mode],
  };
}

/**
 * Remove the matched keyword from the text, cleaning up any trailing colon
 * or whitespace that may follow it.
 *
 * @param text The original message text.
 * @param result The `ModeResult` from `detectMode()`.
 * @returns The text with the keyword stripped.
 */
export function stripKeyword(text: string, result: ModeResult): string {
  const before = text.slice(0, result.index);
  const after = text.slice(result.index + result.keyword.length);

  // Remove any colon + optional whitespace after the keyword
  // (e.g. "fein: do this" -> "do this")
  const cleaned = after.replace(/^:\s*/, "");

  // Collapse double spaces and trim both ends (handles keyword at start,
  // end, or middle of text, plus extra whitespace around colon)
  return (before + cleaned).replace(/\s{2,}/g, " ").trim();
}

/**
 * Get the mode prompt text for a given mode name.
 *
 * @param mode The mode keyword (e.g. "fein", "sonar", "blitz").
 * @returns The prompt string, or empty string if mode is unknown.
 */
export function getModePrompt(mode: string): string {
  if (isModeKeyword(mode)) {
    return MODE_PROMPTS[mode];
  }
  return "";
}

/**
 * Get the mode marker string for a given mode name.
 *
 * @param mode The mode keyword (e.g. "fein", "sonar", "blitz").
 * @returns The marker string (e.g. `[MODE: fein]`), or empty string if unknown.
 */
export function getModeMarker(mode: string): string {
  if (isModeKeyword(mode)) {
    return MODE_MARKERS[mode];
  }
  return "";
}

/**
 * Type guard to check if a string is a valid ModeKeyword.
 */
function isModeKeyword(value: string): value is ModeKeyword {
  return (VALID_KEYWORDS as readonly string[]).includes(value);
}
