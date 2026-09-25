import { readFileSync } from 'node:fs';

// Strip the sync pipeline's auto-generated `<!-- ... -->` header, if present;
// the template content used at runtime starts after it.
export const stripAutoGenComment = (content: string): string => {
  const trimmed = content.trimStart();
  if (trimmed.startsWith('<!--')) {
    const end = trimmed.indexOf('-->');
    if (end !== -1) {
      return trimmed.slice(end + 3).trimStart();
    }
  }
  return content;
};

// Read a synced markdown file, stripped with one trailing newline.
// Returns null (after a warning) when unreadable so callers skip it.
export const readSyncedMarkdown = (filePath: string, label: string): string | null => {
  try {
    const raw = readFileSync(filePath, 'utf-8');
    return `${stripAutoGenComment(raw).replace(/\s+$/u, '')}\n`;
  } catch (error) {
    console.warn(`[maestria-v2] Failed to read ${label} "${filePath}":`, error);
    return null;
  }
};
