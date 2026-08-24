/**
 * Cloudflare Pages catch-all Function: markdown content negotiation.
 *
 * Agents that send `Accept: text/markdown` get the page's markdown twin
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
  VARY_VALUE,
  markdownTwinPath,
  wantsMarkdown,
} from '../src/lib/agent-delivery.ts';

/** Minimal structural shape of the ASSETS binding. */
export interface AssetsBindingLike {
  fetch(input: Request | string | URL, init?: RequestInit): Promise<Response>;
}

/** Minimal structural shape of a Pages Function event context. */
export interface EventContextLike {
  request: Request;
  env: { ASSETS: AssetsBindingLike };
  next: (input?: Request | string) => Promise<Response>;
}

const SITE_ORIGIN = 'https://maestria.sznm.dev';

/** Recovery links listed in the markdown-formatted 404 body. */
const RECOVERY_LINKS: [label: string, href: string][] = [
  ['Maestria home', `${SITE_ORIGIN}/`],
  ['Markdown summary for agents', `${SITE_ORIGIN}/llms.txt`],
  ['Full documentation for agents', `${SITE_ORIGIN}/llms-full.txt`],
  ['Sitemap', `${SITE_ORIGIN}/sitemap-index.xml`],
  ['When to Use Maestria', `${SITE_ORIGIN}/core/when-to-use/`],
  ['GitHub repository', 'https://github.com/agustinusnathaniel/maestria'],
];

/**
 * Markdown-formatted HTTP 404 for agents: short, parseable, with absolute
 * recovery links only (no relative URLs to resolve against a dead path).
 */
function markdownNotFoundResponse(isHead: boolean): Response {
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
    'Content-Type': MARKDOWN_MIME,
    Vary: VARY_VALUE,
    'Cache-Control': 'no-store',
  });
  return new Response(isHead ? null : lines.join('\n'), { status: 404, headers });
}

/**
 * Negotiated delivery handler. Exported separately from `onRequest` so tests
 * can drive it with a fake context.
 */
export async function handleAgentDelivery(context: EventContextLike): Promise<Response> {
  const { request } = context;
  if (request.method !== 'GET' && request.method !== 'HEAD') return context.next();

  const accept = request.headers.get('accept');
  if (!wantsMarkdown(accept)) return context.next();

  const url = new URL(request.url);
  // Responses to HEAD must not carry a body; pass null instead of a stream.
  const isHead = request.method === 'HEAD';

  const twinPath = markdownTwinPath(url.pathname);
  const twin = await context.env.ASSETS.fetch(new URL(twinPath, url.origin));
  if (twin.status === 200) {
    const headers = new Headers({
      'Content-Type': MARKDOWN_MIME,
      Vary: VARY_VALUE,
    });
    const cacheControl = twin.headers.get('Cache-Control');
    if (cacheControl) headers.set('Cache-Control', cacheControl);
    return new Response(isHead ? null : twin.body, { status: 200, headers });
  }

  // No twin: re-fetch the original asset so known pages without a twin still
  // serve normally instead of turning into a 404.
  const original = await context.env.ASSETS.fetch(new URL(url.pathname, url.origin));
  if (original.status === 200) return original;

  return markdownNotFoundResponse(isHead);
}

export const onRequest = handleAgentDelivery;
