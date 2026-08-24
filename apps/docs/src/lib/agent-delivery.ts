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

interface AcceptRange {
  mediaType: string;
  quality: number;
}

function parseAcceptRanges(accept: string): AcceptRange[] {
  return accept.split(',').flatMap((mediaRange) => {
    const [rawType, ...parameters] = mediaRange.split(';');
    const mediaType = rawType?.trim().toLowerCase();
    if (!mediaType?.includes('/')) return [];

    let quality = 1;
    for (const parameter of parameters) {
      const [name, ...rawValue] = parameter.split('=');
      if (name?.trim().toLowerCase() !== 'q') continue;
      const parsed = Number(rawValue.join('=').trim());
      quality = Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0;
    }

    return [{ mediaType, quality }];
  });
}

function qualityFor(ranges: AcceptRange[], target: string): number {
  const [targetType, targetSubtype] = target.split('/');
  let specificity = -1;
  let quality = 0;

  for (const range of ranges) {
    const [rangeType, rangeSubtype] = range.mediaType.split('/');
    const currentSpecificity =
      rangeType === targetType && rangeSubtype === targetSubtype
        ? 2
        : rangeType === targetType && rangeSubtype === '*'
          ? 1
          : rangeType === '*' && rangeSubtype === '*'
            ? 0
            : -1;
    if (currentSpecificity < 0) continue;
    if (currentSpecificity > specificity) {
      specificity = currentSpecificity;
      quality = range.quality;
    } else if (currentSpecificity === specificity) {
      quality = Math.max(quality, range.quality);
    }
  }

  return quality;
}

/**
 * True when the request explicitly accepts Markdown at least as strongly as
 * HTML. Bare wildcards (or an absent header) never negotiate Markdown, and
 * quality values follow the HTTP `Accept` header contract.
 */
export function wantsMarkdown(accept: string | null | undefined): boolean {
  if (typeof accept !== 'string') return false;

  const ranges = parseAcceptRanges(accept);
  const explicitlyAcceptsMarkdown = ranges.some(
    (range) => range.mediaType === 'text/markdown' && range.quality > 0,
  );
  if (!explicitlyAcceptsMarkdown) return false;

  return qualityFor(ranges, 'text/markdown') >= qualityFor(ranges, 'text/html');
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
