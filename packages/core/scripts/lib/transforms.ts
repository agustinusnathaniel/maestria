// packages/core/scripts/lib/transforms.ts - Content transform functions

import { stringify as yamlStringify } from 'yaml';

import type { ReplaceOp } from './config.js';

// ── Constants ──

export const FRONTMATTER_RE = /^---[\s\S]*?\n---\n*/u;

// ── Transforms ──

export const stripFrontmatter = (content: string): string => content.replace(FRONTMATTER_RE, '');

export const findAndReplace = (content: string, ops: ReplaceOp[]): string => {
  let result = content;
  for (const op of ops) {
    result = result.split(op.from).join(op.to);
  }
  return result;
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
