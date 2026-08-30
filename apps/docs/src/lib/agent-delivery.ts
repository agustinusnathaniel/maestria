/**
 * Agent-facing content negotiation helpers.
 *
 * No Astro or worker runtime dependencies are required, so this module can be
 * bundled into a Cloudflare Pages Function and imported by Vitest directly.
 */
import Negotiator from 'negotiator';

/** Content type served for markdown twins. */
export const MARKDOWN_MIME = 'text/markdown; charset=utf-8';

/** Vary value advertised on negotiated responses. */
export const VARY_VALUE = 'Accept, Accept-Encoding';

const SUPPORTED_MEDIA_TYPES = ['text/markdown', 'text/html'] as const;

/** Shared absolute recovery links for the agent 404 and the human 404 page. */
export const RECOVERY_LINKS = [
  ['Maestria home', 'https://maestria.sznm.dev/'],
  ['Markdown summary for agents', 'https://maestria.sznm.dev/llms.txt'],
  ['Full documentation for agents', 'https://maestria.sznm.dev/llms-full.txt'],
  ['Agent instructions', 'https://maestria.sznm.dev/agents.md'],
  ['Sitemap', 'https://maestria.sznm.dev/sitemap-index.xml'],
  ['When to Use Maestria', 'https://maestria.sznm.dev/core/when-to-use/'],
  ['GitHub repository', 'https://github.com/agustinusnathaniel/maestria'],
] as const;

/**
 * True when the request accepts Markdown at least as strongly as HTML.
 * A bare all-media wildcard (or an absent header) never negotiates Markdown, while
 * `text/*` follows the content-negotiation behavior used by Cloudflare's
 * Markdown for Agents feature. The protocol parsing is delegated to the
 * mature `negotiator` package rather than maintained locally.
 */
export function wantsMarkdown(accept: string | null | undefined): boolean {
  if (typeof accept !== 'string') {
    return false;
  }

  // Ignore media-type parameters other than `q`: `negotiator` correctly
  // parses them, but treats parameters such as `charset` as part of the
  // available media type comparison rather than as request metadata.
  const normalizedAccept = accept
    .toLowerCase()
    .split(',')
    .map((range) => {
      const [mediaType, ...parameters] = range.split(';');
      const quality = parameters.find((parameter) => parameter.trim().startsWith('q='));
      return quality ? `${mediaType?.trim()};${quality.trim()}` : mediaType?.trim();
    })
    .filter((range): range is string => Boolean(range))
    .join(',');
  const negotiator = new Negotiator({ headers: { accept: normalizedAccept } });
  const acceptedRanges = negotiator.mediaTypes();
  const acceptsText = acceptedRanges.some(
    (range) => range === 'text/markdown' || range === 'text/*',
  );

  return acceptsText && negotiator.mediaType(SUPPORTED_MEDIA_TYPES) === 'text/markdown';
}

/**
 * Map a site path to its markdown twin.
 *
 * Dist layout (verified against `dist/` after `astro build`) is ground truth:
 * starlight-page-actions writes flat `.md` siblings, e.g. `/opencode/` ->
 * `/opencode.md`, `/core/how-it-works/` -> `/core/how-it-works.md`.
 *
 * - `/` maps to `/llms.txt`: the homepage has no page twin, and llms.txt is
 *   its markdown representation for agents.
 * - Everything else appends `.md` to the trailing-slash-normalized path.
 * - Query and hash are stripped defensively, and a trailing `.html` is
 *   dropped before appending `.md`.
 */
export function markdownTwinPath(pathname: string): string {
  // Callers pass url.pathname; strip query/hash defensively anyway.
  let path = pathname.split('?')[0] ?? '';
  path = path.split('#')[0] ?? '';
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }
  if (path.length > 1 && path.endsWith('/')) {
    path = path.replace(/\/+$/u, '');
  }
  if (path.length > 1 && path.toLowerCase().endsWith('.html')) {
    path = path.slice(0, -'.html'.length);
  }
  if (path === '/' || path === '') {
    return '/llms.txt';
  }
  return `${path}.md`;
}
