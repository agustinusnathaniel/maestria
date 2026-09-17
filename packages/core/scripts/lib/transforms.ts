// packages/core/scripts/lib/transforms.ts - Content transform functions

import { stringify as yamlStringify } from 'yaml';

import type { ReplaceOp } from './config.js';

// ── Constants ──

const FRONTMATTER_RE = /^---[\s\S]*?\n---\n*/u;

// ── Transforms ──

export const stripFrontmatter = (content: string): string => content.replace(FRONTMATTER_RE, '');

const countOccurrences = (content: string, needle: string): number => {
  if (needle === '') {
    return 0;
  }
  let count = 0;
  let index = content.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = content.indexOf(needle, index + needle.length);
  }
  return count;
};

export const applyReplaceOps = (
  content: string,
  ops: ReplaceOp[],
): { content: string; matches: number[] } => {
  let result = content;
  const matches: number[] = [];
  for (const op of ops) {
    matches.push(countOccurrences(result, op.from));
    result = result.split(op.from).join(op.to);
  }
  return { content: result, matches };
};

export const serializeFrontmatter = (data: Record<string, unknown> | string | null): string => {
  if (data === null) {
    return '';
  }
  if (typeof data === 'string') {
    if (data.startsWith('---')) {
      return data;
    }
    return `---\n${data}\n---\n`;
  }
  return `---\n${yamlStringify(data, { lineWidth: 0 })}---\n`;
};

export const stripSourceComment = (content: string): string =>
  content.replace(/^<!--\s*Source:\s*[^\n]*-->\n?/u, '');

export const normalizeLineEndings = (content: string): string => content.replaceAll('\r\n', '\n');
