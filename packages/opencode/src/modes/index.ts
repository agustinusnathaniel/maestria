import { MODE_PROMPTS, MODE_MARKERS, VALID_KEYWORDS } from "./prompts";
import { findAllCodeBlockRanges } from "./helpers";
import type { ModeKeyword, ModeResult } from "./types";

/**
 * Build a regex pattern for word-boundary matching of the given keyword.
 *
 * The pattern uses `\b` word boundaries to ensure we match whole words only,
 * and is case-insensitive so `Fein`, `FEIN`, `fein` all match.
 */
function buildKeywordRegex(keyword: string): RegExp {
  return new RegExp(`\\b${escapeRegex(keyword)}\\b`, "gi");
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Check if a character index falls within any of the given ranges.
 */
function isInRanges(index: number, ranges: Array<[number, number]>): boolean {
  return ranges.some(([start, end]) => index >= start && index < end);
}

/**
 * Detect a workflow mode keyword in the given text.
 *
 * Detection rules (per ADR-008):
 * - Word-boundary regex matching (`\bfein\b`, `\bsonar\b`, `\bblitz\b`)
 * - Code-block-aware — skips matches inside fenced/inline backtick ranges
 * - Rightmost match wins (allows user to correct themselves mid-message)
 * - Case-insensitive
 * - Disabled keywords are ignored
 *
 * @param text The user message to scan.
 * @param disabled Optional set of disabled mode keywords (lowercase).
 * @returns A `ModeResult` if a keyword was detected, or `null`.
 */
export function detectMode(text: string, disabled?: Set<string>): ModeResult | null {
  // Find all code block ranges once
  const codeRanges = findAllCodeBlockRanges(text);

  let bestMatch: { keyword: string; index: number; mode: ModeKeyword } | null = null;

  for (const keyword of VALID_KEYWORDS) {
    // Skip disabled keywords
    if (disabled?.has(keyword)) continue;

    const regex = buildKeywordRegex(keyword);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const index = match.index;

      // Skip matches inside code blocks
      if (isInRanges(index, codeRanges)) continue;

      // Rightmost-wins: more recent match overwrites previous
      if (bestMatch === null || index > bestMatch.index) {
        bestMatch = {
          keyword: match[0],
          index,
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
  // (e.g. "fein: do this" → "do this")
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
