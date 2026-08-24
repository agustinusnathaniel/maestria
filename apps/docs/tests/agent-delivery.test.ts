import { describe, expect, it } from 'vite-plus/test';

import {
  MARKDOWN_MIME,
  VARY_VALUE,
  markdownTwinPath,
  wantsMarkdown,
} from '../src/lib/agent-delivery.ts';

describe('MARKDOWN_MIME / VARY_VALUE', () => {
  it('expose the documented constants', () => {
    expect(MARKDOWN_MIME).toBe('text/markdown; charset=utf-8');
    expect(VARY_VALUE).toBe('Accept, Accept-Encoding');
  });
});

describe('wantsMarkdown', () => {
  const truthy = [
    'text/markdown',
    'TEXT/MARKDOWN',
    'Text/Markdown; charset=utf-8',
    'text/html;q=0.9,text/markdown',
    'application/json, text/markdown;q=0.8, */*;q=0.1',
    'text/markdown;q=0.8, */*;q=0.1',
  ];

  const falsy = [
    undefined,
    null,
    '',
    '*/*',
    'text/*',
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'text/html,text/markdown;q=0.9',
    'text/html;q=1,text/markdown;q=0.9',
    'text/markdown;q=0',
    'text/markdown;q=0.8, */*;q=1',
    'text/*;q=0.9,text/markdown;q=0.8',
    'text/markdownx',
    'x-text/markdown',
  ];

  it.each(truthy)('accepts %j', (accept) => {
    expect(wantsMarkdown(accept)).toBe(true);
  });

  it.each(falsy)('rejects %j', (accept) => {
    expect(wantsMarkdown(accept)).toBe(false);
  });

  it('rejects malformed quality values', () => {
    expect(wantsMarkdown('text/markdown;q=not-a-number')).toBe(false);
  });
});

describe('markdownTwinPath', () => {
  // Twin names verified against dist/ after `astro build`:
  // starlight-page-actions writes flat `.md` siblings next to each page
  // directory (e.g. dist/opencode/index.html + dist/opencode.md).
  const verifiedTwins: [string, string][] = [
    ['/', '/llms.txt'],
    ['', '/llms.txt'],
    ['/opencode/', '/opencode.md'],
    ['/opencode', '/opencode.md'],
    ['/core/how-it-works/', '/core/how-it-works.md'],
    ['/opencode/getting-started/installation/', '/opencode/getting-started/installation.md'],
    ['/about/', '/about.md'],
    ['/404.html', '/404.md'],
    ['/core/how-it-works/?utm=x#section', '/core/how-it-works.md'],
  ];

  it.each(verifiedTwins)('maps %j to %j (verified in dist)', (input, expected) => {
    expect(markdownTwinPath(input)).toBe(expected);
  });

  it('never returns a path without a leading slash', () => {
    expect(markdownTwinPath('opencode')).toBe('/opencode.md');
  });
});
