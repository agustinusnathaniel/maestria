import type { ModeKeyword, ModeResult } from '@/modes/types.js';
import { getModePrompt, getModeMarker } from '@/modes/prompts.js';

const MODE_PRIORITY: ModeKeyword[] = ['fein', 'sonar', 'blitz'];

function isInsideCodeBlock(text: string, index: number): boolean {
  // Count ``` before the index
  const before = text.slice(0, index);
  const matches = before.match(/```/g);
  if (!matches) return false;
  return matches.length % 2 !== 0;
}

export function detectMode(text: string, disabledKeywords?: Set<string>): ModeResult | null {
  for (const mode of MODE_PRIORITY) {
    if (disabledKeywords?.has(mode)) continue;

    // Word-boundary regex: \bfein\b, case-insensitive
    const regex = new RegExp(`\\b${mode}\\b`, 'i');
    const match = regex.exec(text);
    if (!match) continue;

    const index = match.index;
    if (isInsideCodeBlock(text, index)) continue;

    return {
      mode,
      keyword: match[0],
      index,
      prompt: getModePrompt(mode),
      marker: getModeMarker(mode),
    };
  }

  return null;
}

export function stripKeyword(text: string, result: ModeResult): string {
  const before = text.slice(0, result.index);
  const after = text.slice(result.index + result.keyword.length);
  // Remove the keyword and any trailing colon+space
  return (before + after).replace(/:?\s*$/, '').trim();
}
