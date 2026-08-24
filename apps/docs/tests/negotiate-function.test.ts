import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { MARKDOWN_MIME, VARY_VALUE } from '../src/lib/agent-delivery.ts';
import {
  type AssetsBindingLike,
  type EventContextLike,
  handleAgentDelivery,
} from '../functions/[[path]].ts';

const ORIGIN = 'https://docs.example.com';

type AssetTable = Map<
  string,
  { status: number; body?: string; contentType?: string; cacheControl?: string }
>;

function makeAssets(table: AssetTable): {
  binding: AssetsBindingLike;
  fetchSpy: ReturnType<typeof vi.fn>;
} {
  const fetchSpy = vi.fn(async (input: Request | string | URL) => {
    const url =
      input instanceof URL ? input : input instanceof Request ? new URL(input.url) : new URL(input);
    const entry = table.get(url.pathname);
    if (!entry || entry.status !== 200) return new Response(null, { status: 404 });
    const headers = new Headers({ 'Content-Type': entry.contentType ?? 'text/plain' });
    if (entry.cacheControl) headers.set('Cache-Control', entry.cacheControl);
    return new Response(entry.body ?? '', { status: 200, headers });
  });
  return { binding: { fetch: fetchSpy }, fetchSpy };
}

/** Test context: the structural shape plus spy handles for assertions. */
interface TestContext extends EventContextLike {
  nextSpy: ReturnType<typeof vi.fn>;
  fetchSpy: ReturnType<typeof vi.fn>;
}

function makeContext(
  url: string,
  init: { method?: string; accept?: string } = {},
  table: AssetTable = new Map(),
  next = vi.fn(
    async () =>
      new Response('next-html', { status: 200, headers: { 'Content-Type': 'text/html' } }),
  ),
): TestContext {
  const headers = new Headers();
  if (init.accept !== undefined) headers.set('Accept', init.accept);
  const { binding, fetchSpy } = makeAssets(table);
  return {
    request: new Request(url, { method: init.method ?? 'GET', headers }),
    env: { ASSETS: binding },
    next,
    nextSpy: next,
    fetchSpy,
  } as TestContext;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('markdown content negotiation', () => {
  it('(a) serves the verified markdown twin for an agent request', async () => {
    const table: AssetTable = new Map([
      [
        '/opencode.md',
        {
          status: 200,
          body: '# OpenCode\n',
          contentType: 'text/markdown',
          cacheControl: 'public, max-age=3600',
        },
      ],
    ]);
    const context = makeContext(`${ORIGIN}/opencode/`, { accept: 'text/markdown' }, table);

    const res = await handleAgentDelivery(context);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe(MARKDOWN_MIME);
    expect(res.headers.get('Vary')).toBe(VARY_VALUE);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=3600');
    expect(await res.text()).toBe('# OpenCode\n');
    // The internal ASSETS lookup targeted the flat twin sibling from dist.
    expect(context.fetchSpy).toHaveBeenCalledWith(new URL('/opencode.md', ORIGIN));
    expect(context.nextSpy).not.toHaveBeenCalled();
  });

  it('(b) answers unknown paths with a markdown 404 carrying recovery links', async () => {
    const context = makeContext(`${ORIGIN}/does-not-exist`, { accept: 'text/markdown' });

    const res = await handleAgentDelivery(context);

    expect(res.status).toBe(404);
    expect(res.headers.get('Content-Type')).toBe(MARKDOWN_MIME);
    expect(res.headers.get('Vary')).toBe(VARY_VALUE);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const body = await res.text();
    expect(body).toContain('# 404');
    // Recovery links are absolute against the production origin by design,
    // so agents can follow them regardless of where the 404 was served.
    for (const recovery of [
      'https://maestria.sznm.dev/',
      '/llms.txt',
      '/llms-full.txt',
      '/sitemap-index.xml',
      '/core/when-to-use/',
      'https://github.com/agustinusnathaniel/maestria',
    ]) {
      expect(body).toContain(recovery);
    }
  });

  it('(c) passes through untouched when the page exists without a twin', async () => {
    const original = new Response('<html>fine</html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
    const assets: AssetsBindingLike = {
      fetch: vi.fn(async (input: Request | string | URL) => {
        const url =
          input instanceof URL
            ? input
            : input instanceof Request
              ? new URL(input.url)
              : new URL(input);
        return url.pathname.endsWith('.md') ? new Response(null, { status: 404 }) : original;
      }),
    };
    const next = vi.fn(async () => new Response('should-not-be-used'));
    const context = makeContext(
      `${ORIGIN}/some-custom-page/`,
      { accept: 'text/markdown' },
      new Map(),
      next,
    );
    context.env = { ASSETS: assets };

    const res = await handleAgentDelivery(context);

    expect(res).toBe(original);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('<html>fine</html>');
    expect(context.nextSpy).not.toHaveBeenCalled();
  });

  it('(d) lets browser requests through to next()', async () => {
    const browserAccept =
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8';
    const next = vi.fn(async () => new Response('next-html'));
    const context = makeContext(`${ORIGIN}/opencode/`, { accept: browserAccept }, new Map(), next);

    const res = await handleAgentDelivery(context);

    expect(context.fetchSpy).not.toHaveBeenCalled();
    expect(context.nextSpy).toHaveBeenCalledTimes(1);
    expect(await res.text()).toBe('next-html');
  });

  it('(e) never negotiates on POST', async () => {
    const next = vi.fn(async () => new Response('posted'));
    const context = makeContext(
      `${ORIGIN}/opencode/`,
      { method: 'POST', accept: 'text/markdown' },
      new Map(),
      next,
    );

    await handleAgentDelivery(context);

    expect(context.nextSpy).toHaveBeenCalledTimes(1);
  });

  it('answers HEAD with negotiated headers and no body', async () => {
    const table: AssetTable = new Map([['/about.md', { status: 200, body: '# About\n' }]]);
    const context = makeContext(
      `${ORIGIN}/about/`,
      { method: 'HEAD', accept: 'text/markdown' },
      table,
    );

    const res = await handleAgentDelivery(context);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe(MARKDOWN_MIME);
    expect(res.body).toBeNull();
  });
});
