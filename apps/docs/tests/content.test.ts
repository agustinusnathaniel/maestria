import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vite-plus/test';

import { RECOVERY_LINKS } from '../src/lib/agent-delivery.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_ROOT = path.resolve(__dirname, '..', 'src', 'content', 'docs');

/** Strip a leading YAML frontmatter block, returning only the markdown body. */
function stripFrontmatter(text: string): string {
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== '---') return text;
  const close = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (close === -1) return text;
  return lines.slice(close + 1).join('\n');
}

async function readDoc(name: string): Promise<{ full: string; body: string }> {
  const full = await readFile(path.join(DOCS_ROOT, name), 'utf8');
  return { full, body: stripFrontmatter(full) };
}

describe('trust anchor pages', () => {
  it.each([['about.mdx'], ['contact.mdx'], ['privacy.mdx']])(
    '%s carries substantial factual content (>= 500 chars)',
    async (name) => {
      const { body } = await readDoc(name);
      expect(body.trim().length).toBeGreaterThanOrEqual(500);
    },
  );

  it('cross-link each other with relative links', async () => {
    const about = (await readDoc('about.mdx')).body;
    const contact = (await readDoc('contact.mdx')).body;
    const privacy = (await readDoc('privacy.mdx')).body;

    expect(about).toContain('/contact/');
    expect(about).toContain('/privacy/');
    expect(contact).toContain('/about/');
    expect(contact).toContain('/privacy/');
    expect(privacy).toContain('/about/');
    expect(privacy).toContain('/contact/');
  });

  it('state verifiable repo facts without invented identity data', async () => {
    const about = (await readDoc('about.mdx')).body;
    expect(about).toContain('MIT');
    expect(about).toContain('https://github.com/agustinusnathaniel/maestria');
    for (const specialist of [
      'adventurer',
      'architect',
      'builder',
      'diagnose',
      'planner',
      'reviewer',
      'writer',
    ]) {
      expect(about).toContain(specialist);
    }
  });
});

describe('404 page', () => {
  it('points agents at llms.txt and the sitemap via absolute links', async () => {
    const { body } = await readDoc('404.mdx');
    expect(body).toContain('RECOVERY_LINKS.map');
    expect(RECOVERY_LINKS).toContainEqual([
      'Markdown summary for agents',
      'https://maestria.sznm.dev/llms.txt',
    ]);
    expect(RECOVERY_LINKS).toContainEqual([
      'Sitemap',
      'https://maestria.sznm.dev/sitemap-index.xml',
    ]);
    expect(RECOVERY_LINKS).toContainEqual([
      'When to Use Maestria',
      'https://maestria.sznm.dev/core/when-to-use/',
    ]);
  });

  it('keeps its frontmatter hero actions intact', async () => {
    const { full } = await readDoc('404.mdx');
    expect(full).toContain('template: splash');
    expect(full).toContain('- text: Go home');
    expect(full).toContain('- text: Browse Agents');
  });
});

describe('shipped content hygiene', () => {
  it.each([['404.mdx'], ['about.mdx'], ['contact.mdx'], ['privacy.mdx']])(
    '%s has no placeholder or debug markers',
    async (name) => {
      const { full } = await readDoc(name);
      expect(full).not.toMatch(/TODO|FIXME|Lorem ipsum/i);
    },
  );
});
