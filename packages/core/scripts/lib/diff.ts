// packages/core/scripts/lib/diff.ts — Unified diff utility

import { createTwoFilesPatch } from 'diff';

export function unifiedDiff(
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
