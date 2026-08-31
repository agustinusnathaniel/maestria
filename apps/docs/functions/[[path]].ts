/**
 * Cloudflare Pages catch-all Function: markdown content negotiation.
 *
 * Agents that request Markdown with `Accept: text/markdown` or `text/*` get the page's markdown twin
 * (see `markdownTwinPath`) served as `text/markdown` with a `Vary` header so
 * caches keep HTML and markdown responses apart. Browsers never send that
 * Accept value, so every other request falls through to `context.next()`
 * unchanged and static serving is untouched.
 *
 * Routing scope is controlled by `public/_routes.json`; internal
 * `env.ASSETS.fetch()` calls bypass `_routes.json`.
 *
 * Types are structural on purpose: no `@cloudflare/workers-types` dependency.
 * The workerd runtime (and Node 18+ under Vitest) provide Request/Response
 * globals. The library import is bundled by the Pages build.
 */
import {
  MARKDOWN_MIME,
  markdownTwinPath,
  RECOVERY_LINKS,
  VARY_VALUE,
  wantsMarkdown,
} from '../src/lib/agent-delivery.ts';

/** Minimal structural shape of the ASSETS binding. */
export interface AssetsBindingLike {
  fetch: (input: Request | string | URL, init?: RequestInit) => Promise<Response>;
}

/** Minimal structural shape of a Pages Function event context. */
export interface EventContextLike {
  request: Request;
  env: { ASSETS: AssetsBindingLike };
  next: (input?: Request | string) => Promise<Response>;
}

/** Preserve existing cache dimensions while adding the dimensions we vary on. */
const addNegotiatedVary = (headers: Headers): void => {
  const existing =
    headers
      .get('Vary')
      ?.split(',')
      .map((value) => value.trim())
      .filter(Boolean) ?? [];
  const names = new Set(existing.map((value) => value.toLowerCase()));

  for (const value of VARY_VALUE.split(',').map((name) => name.trim())) {
    if (!names.has(value.toLowerCase())) {
      existing.push(value);
      names.add(value.toLowerCase());
    }
  }

  headers.set('Vary', existing.join(', '));
};

/** Preserve the asset response while making the negotiated cache key explicit. */
const withMarkdownVary = (response: Response, isHead: boolean): Response => {
  const headers = new Headers(response.headers);
  addNegotiatedVary(headers);
  return new Response(isHead ? null : response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
};

/** Serve a verified twin with its original cache and validator headers intact. */
const markdownResponse = (response: Response, isHead: boolean): Response => {
  const headers = new Headers(response.headers);
  headers.set('Content-Type', MARKDOWN_MIME);
  addNegotiatedVary(headers);
  return new Response(isHead ? null : response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
};

/**
 * Markdown-formatted HTTP 404 for agents: short, parseable, with absolute
 * recovery links only (no relative URLs to resolve against a dead path).
 */
const markdownNotFoundResponse = (isHead: boolean): Response => {
  const lines = [
    '# 404 - Not found',
    '',
    'The requested path does not exist on this site and has no markdown twin.',
    '',
    'Recovery paths:',
    '',
    ...RECOVERY_LINKS.map(([label, href]) => `- [${label}](${href})`),
    '',
  ];
  const headers = new Headers({
    'Cache-Control': 'no-store',
    'Content-Type': MARKDOWN_MIME,
    Vary: VARY_VALUE,
  });
  return new Response(isHead ? null : lines.join('\n'), { headers, status: 404 });
};

/**
 * Negotiated delivery handler. Exported separately from `onRequest` so tests
 * can drive it with a fake context.
 */
export const handleAgentDelivery = async (context: EventContextLike): Promise<Response> => {
  const { request } = context;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return await context.next();
  }

  const url = new URL(request.url);
  const pathname = url.pathname.toLowerCase();
  if (pathname.endsWith('.md') || pathname.endsWith('.txt')) {
    return await context.next();
  }

  const accept = request.headers.get('accept');
  if (!wantsMarkdown(accept)) {
    return await context.next();
  }

  // Responses to HEAD must not carry a body; pass null instead of a stream.
  const isHead = request.method === 'HEAD';

  const twinPath = markdownTwinPath(url.pathname);
  const twin = await context.env.ASSETS.fetch(new URL(twinPath, url.origin));
  if (twin.status === 200) {
    return markdownResponse(twin, isHead);
  }

  // No twin: re-fetch the original asset so known pages without a twin still
  // serve normally instead of turning into a 404.
  const original = await context.env.ASSETS.fetch(new URL(url.pathname, url.origin));
  if (original.status === 200) {
    return withMarkdownVary(original, isHead);
  }

  return markdownNotFoundResponse(isHead);
};

export const onRequest = handleAgentDelivery;
