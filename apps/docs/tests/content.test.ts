import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vite-plus/test';

import { platforms } from '@/data/platforms.ts';
import { RECOVERY_LINKS } from '@/lib/agent-delivery.ts';

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
  it('documents the artifact boundary and installation path', async () => {
    const { full } = await readDoc('agent-plugins/index.mdx');

    expect(full).toContain('@maestria/agent-plugins');
    expect(full).toContain('compatible clients');
    expect(full).toContain('Install `@maestria/agent-plugins`');
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
    const agentPlugin = await readDoc('agent-plugins/index.mdx');
    const compatibility = await readDoc('agent-plugins/compatibility.mdx');
    const cli = await readDoc('cli/index.mdx');
    const gettingStarted = await readDoc('cli/getting-started.mdx');
    const commands = await readDoc('cli/commands.mdx');
    const about = await readDoc('about.mdx');
    const decisionGuide = await readDoc('core/when-to-use.mdx');
    const howItWorks = await readDoc('core/how-it-works.mdx');

    expect(agentPlugin.full).toContain('args="plugin install"');
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
  it('groups shared-package hosts under Agent Plugins while keeping Pi and OpenCode independent', async () => {
    const guides = await Promise.all(
      ['claude-code', 'codex', 'cursor', 'kimi-code', 'hermes', 'omp'].map(
        async (host) => await readDoc(`agent-plugins/${host}/index.mdx`),
      ),
    );
    for (const { full } of guides) {
      expect(full.length).toBeGreaterThan(0);
    }

    const pi = await readDoc('pi/index.mdx');
    const openCode = await readDoc('opencode/index.mdx');
    expect(pi.full).toContain('@maestria/pi');
    expect(openCode.full).toContain('@maestria/opencode');

    const routes = new Map(platforms.map(({ id, href }) => [id, href]));
    expect(routes.get('claude-code')).toBe('/agent-plugins/claude-code/');
    expect(routes.get('codex')).toBe('/agent-plugins/codex/');
    expect(routes.get('cursor')).toBe('/agent-plugins/cursor/');
    expect(routes.get('kimi-code')).toBe('/agent-plugins/kimi-code/');
    expect(routes.get('hermes')).toBe('/agent-plugins/hermes/');
    expect(routes.get('omp')).toBe('/agent-plugins/omp/');
    expect(routes.get('pi')).toBe('/pi/');
    expect(routes.get('opencode')).toBe('/opencode/');
  });

  it('redirects prior root host routes without redirecting the new Pi route', async () => {
    const redirects = await readFile(
      path.resolve(__dirname, '..', 'public', '_redirects'),
      'utf-8',
    );
    const netlify = await readFile(path.resolve(__dirname, '..', 'netlify.toml'), 'utf-8');

    expect(redirects).toContain('/claude-code/* /agent-plugins/claude-code/:splat 301');
    expect(redirects).toContain('/pi-omp/* /pi/:splat 301');
    expect(redirects).toContain('/omp/* /agent-plugins/omp/:splat 301');
    expect(netlify).toContain('from = "/codex/*"');
    expect(netlify).toContain('to = "/agent-plugins/codex/:splat"');
    expect(netlify).not.toContain('from = "/pi"');
  });
});
