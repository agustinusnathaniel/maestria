/**
 * Agent-facing content negotiation helpers.
 *
 * Pure string functions with zero runtime dependencies so they can be bundled
 * into a Cloudflare Pages Function and imported by Vitest without any worker
 * or Astro runtime present.
 */

/** Content type served for markdown twins. */
export const MARKDOWN_MIME = 'text/markdown; charset=utf-8';

/** Vary value advertised on negotiated responses. */
export const VARY_VALUE = 'Accept, Accept-Encoding';

/**
 * True when the request's Accept header explicitly asks for markdown.
 *
 * Matched per comma-separated media type so bare wildcards (or an absent
 * header) never negotiate markdown and near-misses such as
 * `text/markdownx` are not accepted — browsers keep receiving HTML
 * exactly as before.
 */
export function wantsMarkdown(accept: string | null | undefined): boolean {
  if (typeof accept !== 'string') return false;
  return accept.split(',').some((mediaRange) => {
    const mediaType = mediaRange.trim().toLowerCase().split(';')[0]?.trim();
    return mediaType === 'text/markdown';
  });
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
  if (!path.startsWith('/')) path = `/${path}`;
  if (path.length > 1 && path.endsWith('/')) {
    path = path.replace(/\/+$/, '');
  }
  if (path.length > 1 && path.toLowerCase().endsWith('.html')) {
    path = path.slice(0, -'.html'.length);
  }
  if (path === '/' || path === '') return '/llms.txt';
  return `${path}.md`;
}
