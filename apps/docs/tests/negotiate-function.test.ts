import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { handleAgentDelivery } from '../functions/[[path]].ts';
import type { AssetsBindingLike, EventContextLike } from '../functions/[[path]].ts';

import { MARKDOWN_MIME, VARY_VALUE } from '@/lib/agent-delivery.ts';

const ORIGIN = 'https://docs.example.com';

const toUrl = (input: Request | string | URL): URL => {
  if (input instanceof URL) {
    return input;
  }
  if (input instanceof Request) {
    return new URL(input.url);
  }
  return new URL(input);
};

const asyncResponse = async (response: Response): Promise<Response> => {
  await Promise.resolve();
  return response;
};

type AssetTable = Map<
  string,
  {
    status: number;
    body?: string;
    contentType?: string;
    cacheControl?: string;
    vary?: string;
  }
>;

const makeAssets = (
  table: AssetTable,
): {
  binding: AssetsBindingLike;
  fetchSpy: ReturnType<typeof vi.fn>;
} => {
  const fetchSpy = vi.fn(async (input: Request | string | URL) => {
    const url = toUrl(input);
    const entry = table.get(url.pathname);
    if (!entry || entry.status !== 200) {
      return await asyncResponse(new Response(null, { status: 404 }));
    }
    const headers = new Headers({ 'Content-Type': entry.contentType ?? 'text/plain' });
    if (entry.cacheControl !== undefined && entry.cacheControl !== '') {
      headers.set('Cache-Control', entry.cacheControl);
    }
    if (entry.vary !== undefined && entry.vary !== '') {
      headers.set('Vary', entry.vary);
    }
    return await asyncResponse(new Response(entry.body ?? '', { headers, status: 200 }));
  });
  return { binding: { fetch: fetchSpy }, fetchSpy };
};

/** Test context: the structural shape plus spy handles for assertions. */
interface TestContext extends EventContextLike {
  nextSpy: ReturnType<typeof vi.fn>;
  fetchSpy: ReturnType<typeof vi.fn>;
}

const makeContext = (
  url: string,
  init: { method?: string; accept?: string } = {},
  table: AssetTable = new Map(),
  next = vi.fn(
    async () =>
      await asyncResponse(
        new Response('next-html', { headers: { 'Content-Type': 'text/html' }, status: 200 }),
      ),
  ),
): TestContext => {
  const headers = new Headers();
  if (init.accept !== undefined) {
    headers.set('Accept', init.accept);
  }
  const { binding, fetchSpy } = makeAssets(table);
  return {
    env: { ASSETS: binding },
    fetchSpy,
    next,
    nextSpy: next,
    request: new Request(url, { headers, method: init.method ?? 'GET' }),
  };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('markdown content negotiation', () => {
  it('(a) serves the verified markdown twin for an agent request', async () => {
    const table: AssetTable = new Map([
      [
        '/opencode.md',
        {
          body: '# OpenCode\n',
          cacheControl: 'public, max-age=3600',
          contentType: 'text/markdown',
          status: 200,
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

  it('preserves existing cache dimensions when adding negotiated dimensions', async () => {
    const table: AssetTable = new Map([
      [
        '/opencode.md',
        {
          body: '# OpenCode\n',
          contentType: 'text/markdown',
          status: 200,
          vary: 'Accept-Language',
        },
      ],
    ]);
    const context = makeContext(`${ORIGIN}/opencode/`, { accept: 'text/markdown' }, table);

    const res = await handleAgentDelivery(context);

    expect(res.headers.get('Vary')).toBe('Accept-Language, Accept, Accept-Encoding');
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
      '/agents.md',
      '/sitemap-index.xml',
      '/core/when-to-use/',
      'https://github.com/agustinusnathaniel/maestria',
    ]) {
      expect(body).toContain(recovery);
    }
  });

  it('(c) passes through untouched when the page exists without a twin', async () => {
    const original = new Response('<html>fine</html>', {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      status: 200,
    });
    const assets: AssetsBindingLike = {
      fetch: vi.fn(async (input: Request | string | URL) => {
        const url = toUrl(input);
        return await asyncResponse(
          url.pathname.endsWith('.md') ? new Response(null, { status: 404 }) : original,
        );
      }),
    };
    const next = vi.fn(async () => await asyncResponse(new Response('should-not-be-used')));
    const context = makeContext(
      `${ORIGIN}/some-custom-page/`,
      { accept: 'text/markdown' },
      new Map(),
      next,
    );
    context.env = { ASSETS: assets };

    const res = await handleAgentDelivery(context);

    expect(res.status).toBe(200);
    expect(res.headers.get('Vary')).toBe(VARY_VALUE);
    expect(res.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
    expect(await res.text()).toBe('<html>fine</html>');
    expect(context.nextSpy).not.toHaveBeenCalled();
  });

  it('(d) lets browser requests through to next()', async () => {
    const browserAccept =
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8';
    const next = vi.fn(async () => await asyncResponse(new Response('next-html')));
    const context = makeContext(`${ORIGIN}/opencode/`, { accept: browserAccept }, new Map(), next);

    const res = await handleAgentDelivery(context);

    expect(context.fetchSpy).not.toHaveBeenCalled();
    expect(context.nextSpy).toHaveBeenCalledTimes(1);
    expect(await res.text()).toBe('next-html');
  });

  it('passes through requests that already target static Markdown or text artifacts', async () => {
    await Promise.all(
      ['/opencode.md', '/llms.txt'].map(async (pathname) => {
        const next = vi.fn(async () => await asyncResponse(new Response('static-artifact')));
        const context = makeContext(
          `${ORIGIN}${pathname}`,
          { accept: 'text/markdown' },
          new Map(),
          next,
        );

        const res = await handleAgentDelivery(context);
        const body = await res.text();

        expect(body).toBe('static-artifact');
        expect(context.nextSpy).toHaveBeenCalledTimes(1);
        expect(context.fetchSpy).not.toHaveBeenCalled();
      }),
    );
  });

  it('(e) never negotiates on POST', async () => {
    const next = vi.fn(async () => await asyncResponse(new Response('posted')));
    const context = makeContext(
      `${ORIGIN}/opencode/`,
      { accept: 'text/markdown', method: 'POST' },
      new Map(),
      next,
    );

    await handleAgentDelivery(context);

    expect(context.nextSpy).toHaveBeenCalledTimes(1);
  });

  it('answers HEAD with negotiated headers and no body', async () => {
    const table: AssetTable = new Map([['/about.md', { body: '# About\n', status: 200 }]]);
    const context = makeContext(
      `${ORIGIN}/about/`,
      { accept: 'text/markdown', method: 'HEAD' },
      table,
    );

    const res = await handleAgentDelivery(context);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe(MARKDOWN_MIME);
    expect(res.body).toBeNull();
  });
});
