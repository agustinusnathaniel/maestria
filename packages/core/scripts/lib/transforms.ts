// Text transforms shared by the root generators in scripts/.

import { stringify as yamlStringify } from 'yaml';

const FRONTMATTER_RE = /^---[\s\S]*?\n---\n*/u;

export const stripFrontmatter = (content: string): string => content.replace(FRONTMATTER_RE, '');

export const serializeFrontmatter = (data: Record<string, unknown> | null): string =>
  data === null ? '' : `---\n${yamlStringify(data, { lineWidth: 0 })}---\n`;

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
