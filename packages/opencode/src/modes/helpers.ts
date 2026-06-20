/**
 * Find all ranges in `text` that are inside fenced code blocks (```...```)
 * or inline backtick spans (`...`).
 *
 * Returns an array of `[start, end]` exclusive ranges. The end index is the
 * position immediately after the closing delimiter.
 *
 * Code-block-aware detection should skip keyword matches that fall within
 * any of these ranges to avoid false positives from code snippets.
 */
export function findAllCodeBlockRanges(text: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  let i = 0;

  while (i < text.length) {
    // Find next backtick
    const tickIndex = text.indexOf("`", i);
    if (tickIndex === -1) break;

    // Check for fenced code block (```)
    if (text.startsWith("```", tickIndex)) {
      const openEnd = tickIndex + 3;
      const closeIndex = text.indexOf("```", openEnd);
      if (closeIndex === -1) {
        // Unclosed fence — range extends to end
        ranges.push([tickIndex, text.length]);
        break;
      }
      ranges.push([tickIndex, closeIndex + 3]);
      i = closeIndex + 3;
      continue;
    }

    // Inline backtick span (`...`)
    const closeTick = text.indexOf("`", tickIndex + 1);
    if (closeTick === -1) {
      // Unclosed backtick — treat rest of text as code, stop scanning
      ranges.push([tickIndex, text.length]);
      break;
    }
    ranges.push([tickIndex, closeTick + 1]);
    i = closeTick + 1;
  }

  return ranges;
}
