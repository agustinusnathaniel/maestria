import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vite-plus/test';

import { RECOVERY_LINKS } from '@/lib/agent-delivery.ts';
import { agents } from '@/data/agents.ts';
import { isPlatformOverview, platforms } from '@/data/platforms.ts';

const __dirname = import.meta.dirname;
const DOCS_ROOT = path.resolve(__dirname, '..', 'src', 'content', 'docs');

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

const readSource = async (relativePath: string): Promise<string> =>
  await readFile(path.resolve(__dirname, '..', relativePath), 'utf-8');

describe('trust anchor pages', () => {
  it.each([['about.mdx'], ['contact.mdx'], ['privacy.mdx']])(
    '%s carries substantial factual content (>= 500 chars)',
    async (name) => {
      const { body } = await readDoc(name);
      expect(body.trim().length).toBeGreaterThanOrEqual(500);
    },
  );

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

describe('portable Agent Plugin documentation', () => {
  it('documents the artifact boundary and installation path', async () => {
    const { full } = await readDoc('agent-plugin/index.mdx');

    expect(full).toContain('@maestria/agent-plugin');
    expect(full).toContain('compatible clients');
    expect(full).toContain('Install `@maestria/agent-plugin`');
    expect(full).toContain('plugin.json');
    expect(full).toContain('skills/<name>/SKILL.md');
    expect(full).toContain('The command is intentionally namespaced as `maestria plugin ...`');
    expect(full).toContain('`maestria install` manages runtime integrations');
    expect(full).toContain('The exact activation command depends on the client');
    expect(full).toContain('native subagent registration');
    expect(full).not.toContain('packages/core/agent-directives');
    expect(full).not.toContain('sync.config.ts');
  });

  it('documents the portable CLI path across user entry points', async () => {
    const agentPlugin = await readDoc('agent-plugin/index.mdx');
    const compatibility = await readDoc('agent-plugin/compatibility.mdx');
    const cli = await readDoc('cli/index.mdx');
    const gettingStarted = await readDoc('cli/getting-started.mdx');
    const commands = await readDoc('cli/commands.mdx');
    const about = await readDoc('about.mdx');
    const decisionGuide = await readDoc('core/when-to-use.mdx');
    const howItWorks = await readDoc('core/how-it-works.mdx');
    const changelog = await readDoc('cli/changelog.mdx');

    expect(agentPlugin.full).toContain('args="plugin install"');
    expect(agentPlugin.full).toContain('https://agent-plugins.org/compatible-clients');
    expect(agentPlugin.full).toContain('[compatibility matrix](/agent-plugin/compatibility/)');
    expect(compatibility.full).toContain('Hermes Agent 0.20.3');
    expect(compatibility.full).toContain('Grok Bot CLI 1.0.0');
    expect(compatibility.full).toContain('Activation remains client-owned');
    expect(cli.full).toContain('Stage a portable Agent Plugin');
    expect(cli.full).toContain('href="/agent-plugin/"');
    expect(gettingStarted.full).toContain('--destination ./staged-plugin');
    expect(commands.full).toContain('~/.cache/maestria/agent-plugins/<name>/<version>/');
    expect(about.full).toContain('npx maestria plugin install');
    expect(decisionGuide.full).toContain('[Portable Agent Plugin](/agent-plugin/)');
    expect(howItWorks.full).toContain('[Agent Plugin package](/agent-plugin/)');
    expect(changelog.full).toContain('maestria plugin validate');
    expect(changelog.full).toContain('## v0.11.1');
  });
});

describe('homepage skip link target', () => {
  it('focuses the first marketing section without adding a second target', async () => {
    const hero = await readSource('src/components/home/home-hero.astro');
    const targetTag = /<section\b[^>]*\bid="_top"[^>]*>/u.exec(hero)?.[0] ?? '';

    expect(targetTag).not.toBe('');
    expect(targetTag).toMatch(/\btabindex="-1"/u);
    expect(targetTag).toMatch(/\baria-labelledby="home-title"/u);
    expect(hero.match(/\bid="_top"/gu)).toHaveLength(1);
  });
});

describe('homepage hierarchy', () => {
  it('places the platform chooser immediately after the hero and keeps one method section', async () => {
    const page = await readSource('src/pages/index.astro');
    const heroIndex = page.indexOf('<HomeHero />');
    const platformsIndex = page.indexOf('<HomePlatforms />');
    const methodIndex = page.indexOf('<HomeMethod />');

    expect(heroIndex).toBeGreaterThanOrEqual(0);
    expect(platformsIndex).toBeGreaterThan(heroIndex);
    expect(methodIndex).toBeGreaterThan(platformsIndex);
    expect(page.match(/<HomeMethod\s*\/>/gu)).toHaveLength(1);
    expect(page).not.toMatch(/HomeAtlas|HomeWhy/u);
  });

  it('uses the source-backed model-provider lock-in label', async () => {
    const proof = await readSource('src/components/home/home-proof.astro');

    expect(proof).toContain("label: 'model-provider lock-in'");
    expect(proof).not.toContain("label: 'vendor lock-in'");
  });
});

describe('homepage specialist progressive enhancement', () => {
  it('server-renders every specialist panel before client enhancement', async () => {
    const specialists = await readSource('src/components/home/home-specialists.astro');

    expect(agents).toHaveLength(8);
    expect(specialists).toContain('class="home-specialists__workspace no-js"');
    expect(specialists).not.toMatch(/hidden=\{index !== 0\}/u);
    expect(specialists).toContain("classList.replace('no-js', 'js')");
    expect(specialists).toContain('activateTab(tabs[0], false, false)');
  });

  it('uses high-contrast semantic tab tokens instead of opacity fading', async () => {
    const marketing = await readSource('src/styles/marketing.css');

    expect(marketing).toContain('--ledger-tab-surface');
    expect(marketing).toContain('--ledger-tab-text');
    expect(marketing).toContain('--ledger-tab-selected-surface');
    expect(marketing).toContain('--ledger-tab-selected-text');
    expect(marketing).not.toContain('opacity: 0.72');
  });
});

describe('plugin overview headings', () => {
  it('integrates the frontmatter title and thesis into one masthead', async () => {
    const platformHero = await readSource('src/components/plugin/platform-hero.astro');
    const pageTitle = await readSource('src/components/docs/page-title.astro');
    const integratedHeading = /<h1\b[^>]*\bclass="platform-masthead__name"[^>]*>/u.exec(
      platformHero,
    )?.[0];

    expect(integratedHeading).toBeDefined();
    expect(integratedHeading).toMatch(/\bid="_top"/u);
    expect(integratedHeading).toMatch(/\btabindex="-1"/u);
    expect(platformHero).toContain('<span>{heading}</span>');
    expect(platformHero).toContain('<h2 class="platform-masthead__title">{title}</h2>');
    expect(pageTitle).toContain('isPlatformOverview');
    expect(pageTitle).toContain('plugin-page-title-placeholder');
    expect(platformHero.match(/\bid="_top"/gu)).toHaveLength(1);
  });

  it('keeps the auxiliary ecosystem entry out of platform overview handling', async () => {
    const pageTitle = await readSource('src/components/docs/page-title.astro');
    const overviewIds = platforms
      .filter((platform) => platform.auxiliary !== true)
      .map((platform) => platform.id);

    expect(platforms.find((platform) => platform.id === 'ecosystem')?.auxiliary).toBe(true);
    expect(isPlatformOverview('ecosystem')).toBe(false);
    expect(overviewIds).toHaveLength(8);
    expect(overviewIds.every((id) => isPlatformOverview(id))).toBe(true);
    expect(pageTitle).toContain('isPlatformOverview(Astro.locals.starlightRoute.id)');
  });
});

describe('plugin overview presentation contracts', () => {
  it('keeps one compact cross-platform navigation instance', async () => {
    const overview = await readSource('src/components/plugin/platform-overview.astro');
    const footer = await readSource('src/components/plugin/site-footer.astro');

    expect(overview).toContain('<SiteFooter compact />');
    expect(overview).not.toMatch(/SiblingPlatforms/u);
    expect(footer).toContain("aria-label={compact ? 'Platform overviews' : 'Footer navigation'}");
    expect(footer).toContain('platformColumns');
  });

  it('keeps every overview to one integrated shell, one concise ledger, and plain docs', async () => {
    const pages = [
      ['opencode/index.mdx', ['8 task agents', 'Compaction context']],
      ['claude-code/index.mdx', ['plugin validate --strict', '3 workflow commands']],
      ['codex/index.mdx', ['Two Codex layers, one workflow.', '7 agent types']],
      ['kimi-code/index.mdx', ['systemPromptPath', '3 built-in profiles']],
      ['cursor/index.mdx', ['One bundle, two Cursor surfaces.', 'alwaysApply: true']],
      ['pi-omp/index.mdx', ['One method. Two runtime contracts.', '@gotgenes/pi-subagents']],
      [
        'hermes/index.mdx',
        [
          'no canonical maestria CLI install',
          'no native review gate',
          'hermes plugins install agustinusnathaniel/maestria/packages/hermes --enable',
        ],
      ],
      [
        'prime-agent/index.mdx',
        ['14 skills', 'remain deferred', 'prime-agent package install npm:@maestria/prime-agent'],
      ],
    ] as const;
    const comparisonRoutes = new Set([
      'codex/index.mdx',
      'kimi-code/index.mdx',
      'cursor/index.mdx',
      'pi-omp/index.mdx',
    ]);

    await Promise.all(
      pages.map(async ([name, requiredText]) => {
        const { full } = await readDoc(name);
        expect(full.match(/<PlatformOverview\b/gu)).toHaveLength(1);
        expect(full.match(/<PluginSection\b/gu)).toHaveLength(1);
        expect(full.match(/<CapabilityLedger\b/gu)).toHaveLength(1);
        expect(full.match(/<DocsLinkList\b/gu)).toHaveLength(1);
        expect(full).toContain('compact');
        expect(full).not.toMatch(
          /FeatureGrid|PluginHero|PlatformHero|SiblingPlatforms|SiteFooter|SupportBoundary/u,
        );
        expect(full).not.toMatch(/\b(?:index|kicker)=/u);
        for (const text of requiredText) {
          expect(full).toContain(text);
        }

        const facts =
          /facts=\{\[(?<facts>[\s\S]*?)\]\}\s+primaryCta/u.exec(full)?.groups?.facts ?? '';
        const ledger = /items=\{\[(?<ledger>[\s\S]*?)\]\}/u.exec(full)?.groups?.ledger ?? '';
        expect(facts).not.toBe('');
        expect(ledger).not.toBe('');
        expect(facts.match(/\blabel:/gu)?.length ?? 0).toBeGreaterThanOrEqual(2);
        expect(facts.match(/\blabel:/gu)?.length ?? 0).toBeLessThanOrEqual(3);
        expect(ledger.match(/\blabel:/gu)?.length ?? 0).toBeGreaterThanOrEqual(4);
        expect(ledger.match(/\blabel:/gu)?.length ?? 0).toBeLessThanOrEqual(6);

        if (comparisonRoutes.has(name)) {
          expect(full.match(/<SurfaceComparison\b/gu)).toHaveLength(1);
        } else {
          expect(full).not.toContain('SurfaceComparison');
        }
      }),
    );
  });

  it('retains the documented page action names and menu semantics', async () => {
    const pageActions = await readSource('src/components/docs/page-action-menu.astro');

    expect(pageActions).toContain('Copy Markdown');
    expect(pageActions).toContain("translate('open', 'Open')");
    expect(pageActions).toContain("translate('view.markdown', 'View in Markdown')");
    expect(pageActions).toContain("translate('share', 'Share')");
    expect(pageActions.match(/aria-haspopup="menu"/gu)).toHaveLength(2);
    expect(pageActions).toContain('starlightRoute?.id');
    expect(pageActions).toContain('aria-labelledby={openToggleId}');
    expect(pageActions).toContain('aria-labelledby={shareToggleId}');
    expect(pageActions).toContain('event.detail === 0');
    expect(pageActions).toContain('openMenu(menu, menus, toggles, focusFirst)');
  });

  it('does not introduce forbidden product concepts into overview sources', async () => {
    const overviewFiles = [
      'src/components/plugin/capability-ledger.astro',
      'src/components/plugin/platform-overview.astro',
      'src/components/plugin/surface-comparison.astro',
      'src/data/platforms.ts',
      'src/content/docs/opencode/index.mdx',
      'src/content/docs/claude-code/index.mdx',
      'src/content/docs/codex/index.mdx',
      'src/content/docs/kimi-code/index.mdx',
      'src/content/docs/cursor/index.mdx',
      'src/content/docs/pi-omp/index.mdx',
      'src/content/docs/hermes/index.mdx',
      'src/content/docs/prime-agent/index.mdx',
    ];
    const sources = await Promise.all(overviewFiles.map(async (file) => await readSource(file)));
    const combined = sources.join('\n');

    expect(combined).not.toMatch(/\bvite\b/iu);
    expect(combined).not.toMatch(/xtarter/iu);
  });

  it('keeps compact labels structural without adding support fields', () => {
    const integrations = platforms.filter((platform) => platform.auxiliary !== true);

    expect(integrations.every((platform) => Boolean(platform.shortName))).toBe(true);
    expect(Object.keys(integrations[0] ?? {})).not.toContain('support');
    expect(Object.keys(integrations[0] ?? {})).not.toContain('enforcement');
  });
});

describe('shipped content hygiene', () => {
  it.each([['404.mdx'], ['about.mdx'], ['contact.mdx'], ['privacy.mdx']])(
    '%s has no placeholder or debug markers',
    async (name) => {
      const { full } = await readDoc(name);
      expect(full).not.toMatch(/TODO|FIXME|Lorem ipsum/iu);
    },
  );
});
