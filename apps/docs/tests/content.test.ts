import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { getTransformedRoutes } from '@vercel/routing-utils';
import type { Route, RouteWithSrc } from '@vercel/routing-utils';
import { describe, expect, it } from 'vite-plus/test';

import { platforms } from '@/data/platforms.ts';
import { RECOVERY_LINKS } from '@/lib/agent-delivery.ts';

const __dirname = import.meta.dirname;
const DOCS_ROOT = path.resolve(__dirname, '..', 'src', 'content', 'docs');
const APP_ROOT = path.resolve(__dirname, '..');

const INSTALL = '/agent-plugins/installation/';
const USAGE = '/agent-plugins/usage/#per-host-syntax';

/** Hosts whose `/agent-plugins/<host>/` page trees were merged into Installation and Usage. */
const REMOVED_HOSTS = [
  'claude-code',
  'codex',
  'cursor',
  'kimi-code',
  'devin',
  'zcode',
  'omp',
  'hermes',
];

/** Every removed HTML route (no trailing slash) and where it now redirects. */
const REMOVED_ROUTES: [string, string][] = [
  ...REMOVED_HOSTS.map((host): [string, string] => [
    `/agent-plugins/${host}`,
    `${INSTALL}#${host}`,
  ]),
  ...['claude-code', 'codex', 'cursor', 'kimi-code', 'hermes', 'omp'].flatMap(
    (host): [string, string][] => [
      [
        `/agent-plugins/${host}/getting-started/installation`,
        `${INSTALL}#${host === 'codex' ? 'codex-cli' : host}`,
      ],
      [`/agent-plugins/${host}/getting-started/quick-start`, USAGE],
      [`/agent-plugins/${host}/contributing`, '/agent-plugins/contributing/'],
      [`/agent-plugins/${host}/changelog`, '/agent-plugins/legacy-changelog/'],
    ],
  ),
  ['/agent-plugins/codex/getting-started/desktop', `${INSTALL}#codex-desktop`],
  ['/agent-plugins/omp/reference', `${INSTALL}#omp`],
  ['/agent-plugins/hermes/commands', USAGE],
  // Root-level routes that predate the /agent-plugins/ grouping.
  ...['claude-code', 'codex', 'cursor', 'kimi-code', 'hermes', 'omp'].map(
    (host): [string, string] => [`/${host}`, `${INSTALL}#${host}`],
  ),
];

/** Installation headings that other pages and redirects link to. */
const INSTALL_ANCHORS = [
  'claude-code',
  'codex',
  'codex-cli',
  'codex-desktop',
  'cursor',
  'kimi-code',
  'devin',
  'zcode',
  'omp',
  'hermes',
  'hermes-manual-context',
];

/** `.md` twin of an HTML redirect target: anchors are dropped. */
const markdownTwin = (target: string): string => {
  const [route = ''] = target.split('#');
  return `${route.replace(/\/$/u, '')}.md`;
};

/** Heading ids as Starlight generates them for simple headings. */
const headingAnchors = (text: string): string[] =>
  [...text.matchAll(/^#{2,4} (?<heading>.+)$/gmu)].map(({ groups }) =>
    (groups?.heading ?? '')
      .toLowerCase()
      .replaceAll(/[^\p{L}\p{N}\s-]/gu, '')
      .trim()
      .replaceAll(/\s/gu, '-'),
  );

interface VercelRedirect {
  source: string;
  destination: string;
  permanent: boolean;
}

const isVercelRedirect = (value: unknown): value is VercelRedirect =>
  typeof value === 'object' &&
  value !== null &&
  'source' in value &&
  typeof value.source === 'string' &&
  'destination' in value &&
  typeof value.destination === 'string' &&
  'permanent' in value &&
  typeof value.permanent === 'boolean';

/** Read the `redirects` array of `vercel.json`. */
const readVercelRedirects = async (): Promise<VercelRedirect[]> => {
  const parsed: unknown = JSON.parse(
    await readFile(path.resolve(APP_ROOT, 'vercel.json'), 'utf-8'),
  );
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('redirects' in parsed) ||
    !Array.isArray(parsed.redirects) ||
    !parsed.redirects.every(isVercelRedirect)
  ) {
    throw new TypeError('vercel.json has an invalid redirects array');
  }
  return parsed.redirects;
};

/** Vercel's compiled routes mix redirect patterns with internal phase handlers. */
const isSourceRoute = (route: Route): route is RouteWithSrc => !('handle' in route);

/**
 * Resolve a path the way Vercel does: compile `vercel.json` with Vercel's own route transform and
 * return the Location of the first permanent redirect whose pattern matches.
 */
const vercelResolver = async (): Promise<(pathname: string) => string | undefined> => {
  const { error, routes } = getTransformedRoutes({ redirects: await readVercelRedirects() });
  if (error !== null || routes === null) {
    throw new TypeError(`vercel.json redirects do not compile: ${JSON.stringify(error)}`);
  }
  const compiled = routes.filter(isSourceRoute).flatMap((route) => {
    const location = route.headers?.Location;
    return route.status === 308 && location !== undefined
      ? [{ location, pattern: new RegExp(route.src, 'u') }]
      : [];
  });
  return (pathname) => compiled.find(({ pattern }) => pattern.test(pathname))?.location;
};

/** Parse `_redirects` into a `from -> to` map (status must be 301). */
const readRedirects = async (): Promise<Map<string, string>> => {
  const text = await readFile(path.resolve(APP_ROOT, 'public', '_redirects'), 'utf-8');
  const map = new Map<string, string>();
  for (const line of text.split('\n')) {
    if (line.trim() === '' || line.startsWith('#')) {
      continue;
    }
    const [from = '', to = '', status] = line.trim().split(/\s+/u);
    expect(status, line).toBe('301');
    expect(map.has(from), `duplicate redirect source ${from}`).toBe(false);
    map.set(from, to);
  }
  return map;
};

/** Strip a leading YAML frontmatter block, returning only the markdown body. */
const stripFrontmatter = (text: string): string => {
  const lines = text.split(/\r?\n/u);
  if (lines[0]?.trim() !== '---') {
    return text;
  }
  const close = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (close === -1) {
    return text;
  }
  return lines.slice(close + 1).join('\n');
};

const readDoc = async (name: string): Promise<{ full: string; body: string }> => {
  const full = await readFile(path.join(DOCS_ROOT, name), 'utf-8');
  return { body: stripFrontmatter(full), full };
};

describe('trust anchor pages', () => {
  it('cross-link each other with relative links', async () => {
    const aboutDoc = await readDoc('about.mdx');
    const contactDoc = await readDoc('contact.mdx');
    const privacyDoc = await readDoc('privacy.mdx');
    const about = aboutDoc.body;
    const contact = contactDoc.body;
    const privacy = privacyDoc.body;

    expect(about).toContain('/contact/');
    expect(about).toContain('/privacy/');
    expect(contact).toContain('/about/');
    expect(contact).toContain('/privacy/');
    expect(privacy).toContain('/about/');
    expect(privacy).toContain('/contact/');
  });

  it('state verifiable repo facts without invented identity data', async () => {
    const aboutDoc = await readDoc('about.mdx');
    const about = aboutDoc.body;
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
    expect(body).toContain('## Recovery paths for agents and humans');
    expect(body).toContain('Every link below is absolute');
    expect(RECOVERY_LINKS).toContainEqual([
      'Markdown summary for agents',
      'https://maestria.sznm.dev/llms.txt',
    ]);
    expect(RECOVERY_LINKS).toContainEqual([
      'Sitemap',
      'https://maestria.sznm.dev/sitemap-index.xml',
    ]);
    expect(RECOVERY_LINKS).toContainEqual([
      'When to Use maestria',
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

describe('portable Agent Plugin documentation', () => {
  it('documents the artifact boundary on the overview page', async () => {
    const { full } = await readDoc('agent-plugins/index.mdx');

    expect(full).toContain('@maestria/agent-plugins');
    expect(full).toContain('compatible clients');
    expect(full).toContain('https://agent-plugins.org/compatible-clients');
    expect(full).toContain('skills/<name>/SKILL.md');
    expect(full).toContain('native subagent registration');
    expect(full).toContain('[compatibility matrix](/agent-plugins/compatibility/)');
    expect(full).not.toContain('packages/core/agent-directives');
    expect(full).not.toContain('sync.config.ts');
  });

  it('documents the staging path and every host on the installation page', async () => {
    const { full } = await readDoc('agent-plugins/installation.mdx');

    expect(full).toContain('Install `@maestria/agent-plugins`');
    expect(full).toContain('args="plugin install"');
    expect(full).toContain('plugin.json');
    expect(full).toContain('The command is intentionally namespaced as `maestria plugin ...`');
    expect(full).toContain('`maestria install` manages runtime integrations');
    expect(full).toContain('The exact activation command depends on the client');

    const anchors = headingAnchors(full);
    for (const anchor of INSTALL_ANCHORS) {
      expect(anchors).toContain(anchor);
    }
  });

  it('documents the portable CLI path across user entry points', async () => {
    const agentPlugin = await readDoc('agent-plugins/index.mdx');
    const compatibility = await readDoc('agent-plugins/compatibility.mdx');
    const cli = await readDoc('cli/index.mdx');
    const gettingStarted = await readDoc('cli/getting-started.mdx');
    const commands = await readDoc('cli/commands.mdx');
    const about = await readDoc('about.mdx');
    const decisionGuide = await readDoc('core/when-to-use.mdx');
    const howItWorks = await readDoc('core/how-it-works.mdx');

    expect(agentPlugin.full).toContain('https://agent-plugins.org/compatible-clients');
    expect(agentPlugin.full).toContain('[compatibility matrix](/agent-plugins/compatibility/)');
    expect(compatibility.full).toContain('Activation remains client-owned');
    expect(cli.full).toContain('Stage a portable Agent Plugin');
    expect(cli.full).toContain('href="/agent-plugins/"');
    expect(gettingStarted.full).toContain('--destination ./staged-plugin');
    expect(commands.full).toContain('~/.cache/maestria/agent-plugins/<name>/<version>/');
    expect(about.full).toContain('npx maestria plugin install');
    expect(decisionGuide.full).toContain('[Portable Agent Plugin](/agent-plugins/)');
    expect(howItWorks.full).toContain('[Agent Plugin package](/agent-plugins/)');
  });
});

describe('platform guide routes', () => {
  it('lists one card per installable package on the homepage', () => {
    expect(platforms.map(({ id, href }) => [id, href])).toEqual([
      ['opencode', '/opencode/'],
      ['pi', '/pi/'],
      ['agent-plugins', '/agent-plugins/'],
      ['ecosystem', '/ecosystem/'],
    ]);
    const agentPlugins = platforms.find(({ id }) => id === 'agent-plugins');
    expect(agentPlugins?.name).toBe('@maestria/agent-plugins');
    expect(agentPlugins?.hosts).toEqual([
      'Claude Code',
      'Codex',
      'Cursor',
      'Kimi Code',
      'Devin',
      'ZCode',
      'OMP',
      'Hermes',
    ]);
  });

  it('keeps Pi and OpenCode independent of the shared package', async () => {
    const pi = await readDoc('pi/index.mdx');
    const openCode = await readDoc('opencode/index.mdx');
    expect(pi.full).toContain('@maestria/pi');
    expect(openCode.full).toContain('@maestria/opencode');
  });

  it('removes the per-host page trees in favor of Installation and Usage', async () => {
    const missing = await Promise.all(
      REMOVED_HOSTS.map(
        async (host) =>
          await stat(path.join(DOCS_ROOT, 'agent-plugins', host)).then(
            () => false,
            () => true,
          ),
      ),
    );
    expect(missing.every(Boolean)).toBe(true);

    const pages = await Promise.all(
      ['installation', 'usage', 'compatibility', 'contributing', 'changelog'].map(
        async (page) => await readDoc(`agent-plugins/${page}.mdx`),
      ),
    );
    for (const { full } of pages) {
      expect(full.length).toBeGreaterThan(0);
    }
  });

  it('redirects every removed route and its markdown twin on every host', async () => {
    const redirects = await readRedirects();
    const netlify = await readFile(path.resolve(APP_ROOT, 'netlify.toml'), 'utf-8');
    const vercel = await readVercelRedirects();
    // Netlify, like Cloudflare Pages, reads public/_redirects from the published dist/ folder.
    expect(netlify).not.toContain('[[redirects]]');
    expect(netlify).toContain('publish = "dist"');
    // Vercel cannot read _redirects; one `{/}?` rule covers both slash forms of a route.
    const resolveVercel = await vercelResolver();
    const sources = new Set(vercel.map(({ source }) => source));
    expect(
      [...sources].filter((source) => source.endsWith('/') && sources.has(source.slice(0, -1))),
    ).toEqual([]);

    const cases: [string, string][] = [];
    for (const [route, target] of REMOVED_ROUTES) {
      cases.push([route, target], [`${route}/`, target], [`${route}.md`, markdownTwin(target)]);
    }
    // Host index twins end in `.md` directly, without a trailing slash rule.
    for (const [from, to] of cases) {
      expect(redirects.get(from), `_redirects ${from}`).toBe(to);
      expect(resolveVercel(from), `vercel ${from}`).toBe(to);
    }
  });

  it('sends every other path under a removed host tree to its Installation section', async () => {
    const redirects = await readRedirects();
    const resolveVercel = await vercelResolver();

    for (const host of REMOVED_HOSTS) {
      const target = `/agent-plugins/installation/#${host}`;
      expect(redirects.get(`/agent-plugins/${host}/*`)).toBe(target);
      expect(resolveVercel(`/agent-plugins/${host}/any/deeper/page`)).toBe(target);
    }
    for (const host of ['claude-code', 'codex', 'cursor', 'kimi-code', 'hermes', 'omp']) {
      const target = `/agent-plugins/installation/#${host}`;
      expect(redirects.get(`/${host}/*`)).toBe(target);
    }
    expect(redirects.get('/pi-omp/*')).toBe('/pi/:splat');
    expect(redirects.has('/pi')).toBe(false);
  });

  it('never redirects to a removed route and always lands on an existing page and heading', async () => {
    const redirects = await readRedirects();
    const installation = await readDoc('agent-plugins/installation.mdx');
    const usage = await readDoc('agent-plugins/usage.mdx');
    const installAnchors = headingAnchors(installation.full);
    const usageAnchors = headingAnchors(usage.full);
    const removedHostRoute = new RegExp(
      `^/agent-plugins/(${REMOVED_HOSTS.join('|')})(/|\\.md|$)`,
      'u',
    );

    const targets = [...redirects].filter(([, to]) => !to.includes(':splat'));
    const missing = await Promise.all(
      targets.map(async ([from, to]) => {
        const [route = '', anchor] = to.split('#');
        const page = route.replace(/\.md$/u, '').replace(/\/$/u, '').replace(/^\//u, '');
        const exists = await Promise.all(
          [`${page}.mdx`, `${page}/index.mdx`].map(
            async (candidate) =>
              await stat(path.join(DOCS_ROOT, candidate)).then(
                () => true,
                () => false,
              ),
          ),
        );
        let anchors: string[] | undefined;
        if (anchor) {
          anchors = page === 'agent-plugins/usage' ? usageAnchors : installAnchors;
        }
        return {
          anchorMissing: anchor !== undefined && anchors?.includes(anchor) !== true,
          from,
          pageMissing: !exists.some(Boolean),
          removed: removedHostRoute.test(to),
          to,
        };
      }),
    );

    expect(missing.filter(({ removed }) => removed)).toEqual([]);
    expect(missing.filter(({ pageMissing }) => pageMissing)).toEqual([]);
    expect(missing.filter(({ anchorMissing }) => anchorMissing)).toEqual([]);
  });
});
