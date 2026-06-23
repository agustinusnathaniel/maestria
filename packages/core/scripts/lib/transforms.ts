// packages/core/scripts/lib/transforms.ts — Content transform functions

import { stringify as yamlStringify } from 'yaml';
import type { ReplaceOp } from './config.js';

// ── Constants ──

export const FRONTMATTER_RE = /^---[\s\S]*?\n---\n*/;

// ── Transforms ──

export function stripFrontmatter(content: string): string {
  return content.replace(FRONTMATTER_RE, '');
}

export function findAndReplace(content: string, ops: ReplaceOp[]): string {
  let result = content;
  for (const op of ops) {
    result = result.split(op.from).join(op.to);
  }
  return result;
}

export function serializeFrontmatter(data: Record<string, unknown> | string | null): string {
  if (data === null) return '';
  if (typeof data === 'string') {
    if (data.startsWith('---')) return data;
    return `---\n${data}\n---\n`;
  }
  return `---\n${yamlStringify(data, { defaultKeyType: 'QUOTE_DOUBLE' })}---\n`;
}

export function stripSourceComment(content: string): string {
  return content.replace(/^<!--\s*Source:\s*[^\n]*-->\n?/, '');
}

export function normalizeLineEndings(content: string): string {
  return content.replace(/\r\n/g, '\n');
}
