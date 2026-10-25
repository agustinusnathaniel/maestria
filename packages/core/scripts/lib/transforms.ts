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

/**
 * Return one `## heading` section, up to the next H1 or H2, as a standalone
 * document titled by that heading; null when the heading is absent.
 */
export const extractSection = (content: string, heading: string): string | null => {
  const lines = normalizeLineEndings(content).split('\n');
  const start = lines.indexOf(`## ${heading}`);
  if (start === -1) {
    return null;
  }
  const next = lines.findIndex((line, index) => index > start && /^#{1,2} /u.test(line));
  const body = lines.slice(start + 1, next === -1 ? undefined : next).join('\n');
  return `# ${heading}\n\n${body.trim()}\n`;
};

/** Joins `## heading` sections in order, or names the first heading that is missing. */
export const extractSections = (
  content: string,
  headings: string | readonly string[],
): { missing: string } | { section: string } => {
  const sections: string[] = [];
  for (const heading of typeof headings === 'string' ? [headings] : headings) {
    const section = extractSection(content, heading);
    if (section === null) {
      return { missing: heading };
    }
    sections.push(section.trim());
  }
  return { section: `${sections.join('\n\n')}\n` };
};
