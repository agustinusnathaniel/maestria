import starlight from '@astrojs/starlight';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';
import starlightLinksValidator from 'starlight-links-validator';
import starlightLlmsTxt from 'starlight-llms-txt';
import starlightPageActions from 'starlight-page-actions';

export default defineConfig({
  integrations: [
    starlight({
      components: {
        Head: './src/components/starlight-head.astro',
      },
      customCss: ['./src/styles/global.css'],
      description:
        'Portable AI engineering workflows for OpenCode, Claude Code, Codex CLI, and beyond.',
      disable404Route: true,
      head: [
        {
          attrs: {
            content:
              'maestria, maestria AI engineering workflows, maestria plugins, OpenCode, Claude Code, Codex CLI, Kimi Code, Cursor, Pi, Hermes',
            name: 'keywords',
          },
          tag: 'meta',
        },
        {
          attrs: {
            content:
              'https://og.sznm.dev/api/generate?heading=maestria&text=Portable%20AI%20Engineering%20Workflows&template=color',
            property: 'og:image',
          },
          tag: 'meta',
        },
      ],
      plugins: [
        starlightLinksValidator({
          // The 404 hero's "Go home" action points at `/`, i.e. the custom
          // homepage from src/pages/index.astro, which the validator cannot
          // resolve once the page has a markdown body to scan. Exclude exactly
          // that link value instead of disabling validation for the page.
          exclude: ['/'],
        }),
        starlightLlmsTxt({
          description:
            'Portable AI engineering workflows. @maestria/agent-plugins bundles Codex, Claude Code, ' +
            'Cursor, Kimi Code, Devin, ZCode, Hermes, OMP, and portable Agent Plugins resources. ' +
            'Native runtime adapters remain available as @maestria/opencode and @maestria/pi.',
          details:
            'For dedicated usage guidance, installation instructions, and machine-readable resource links, read [maestria agent instructions](https://maestria.sznm.dev/agents.md).',
          optionalLinks: [
            {
              label: 'maestria documentation home',
              url: 'https://maestria.sznm.dev/',
            },
            {
              label: 'maestria When to Use guide',
              url: 'https://maestria.sznm.dev/core/when-to-use/',
            },
            {
              description: 'Installable Agent Plugins v1 package with the standard skills layout.',
              label: 'maestria portable Agent Plugin',
              url: 'https://maestria.sznm.dev/agent-plugins/',
            },
            {
              description: 'Live smoke results and manual activation checks by client.',
              label: 'maestria Agent Plugin compatibility',
              url: 'https://maestria.sznm.dev/agent-plugins/compatibility/',
            },
            {
              description: 'Install with `npx maestria install <platform>`.',
              label: 'maestria CLI getting started',
              url: 'https://maestria.sznm.dev/cli/getting-started/',
            },
            {
              description: 'Every documentation page has a `.md` twin.',
              label: 'maestria page Markdown example',
              url: 'https://maestria.sznm.dev/core/when-to-use.md',
            },
            {
              label: 'maestria sitemap',
              url: 'https://maestria.sznm.dev/sitemap-index.xml',
            },
            {
              label: 'maestria robots.txt',
              url: 'https://maestria.sznm.dev/robots.txt',
            },
            {
              label: 'maestria on npm',
              url: 'https://www.npmjs.com/package/maestria',
            },
            {
              label: 'maestria source repository',
              url: 'https://github.com/agustinusnathaniel/maestria',
            },
            {
              label: 'maestria issue tracker',
              url: 'https://github.com/agustinusnathaniel/maestria/issues',
            },
          ],
          projectName: 'maestria',
        }),
        starlightPageActions({
          prompt:
            'You are an expert on the maestria plugin ecosystem. ' +
            'Read {url} and help me understand how to use these tools ' +
            'effectively.',
          share: true,
        }),
      ],
      sidebar: [
        {
          items: [
            { label: 'When to Use maestria', link: '/core/when-to-use/' },
            { label: 'Specialist Reference', link: '/core/agents/' },
            { label: 'Pipeline & Roles', link: '/core/pipeline/' },
            { label: 'How It Works', link: '/core/how-it-works/' },
            { label: 'Workflow Patterns', link: '/core/workflow-patterns/' },
            { label: 'Contributing', link: '/core/contributing/' },
            { label: 'Contributors', link: '/core/contributors/' },
            { label: 'Changelog', link: '/core/changelog/' },
          ],
          label: 'Core Concepts',
        },
        {
          collapsed: true,
          items: [
            { label: 'Overview', link: '/agent-plugins/' },
            { label: 'Compatibility', link: '/agent-plugins/compatibility/' },
          ],
          label: 'Agent Plugins',
        },
        {
          items: [
            { label: 'About', link: '/about/' },
            { label: 'Contact', link: '/contact/' },
            { label: 'Privacy', link: '/privacy/' },
          ],
          label: 'Project',
        },
        {
          items: [
            { label: 'Overview', link: '/cli/' },
            { label: 'Getting Started', link: '/cli/getting-started/' },
            { label: 'Commands', link: '/cli/commands/' },
            { label: 'Changelog', link: '/cli/changelog/' },
          ],
          label: 'CLI',
        },
        {
          items: [
            { label: 'Overview', link: '/ecosystem/' },
            { label: 'CodeGraph', link: '/ecosystem/codegraph/' },
            { label: 'RTK', link: '/ecosystem/rtk/' },
            { label: 'OpenCode Goal Plugin', link: '/ecosystem/opencode-goal-plugin/' },
          ],
          label: 'Ecosystem',
        },
        {
          collapsed: true,
          items: [
            { label: 'Overview', link: '/opencode/' },
            {
              items: [{ autogenerate: { directory: 'opencode/getting-started' } }],
              label: 'Getting Started',
            },
            { label: 'Configuration', link: '/opencode/configuration/' },
            { label: 'Reference', link: '/opencode/reference/' },
            { label: 'Changelog', link: '/opencode/changelog/' },
            { label: 'Contributing', link: '/opencode/contributing/' },
          ],
          label: '@maestria/opencode',
        },
        {
          collapsed: true,
          items: [
            { label: 'Overview', link: '/kimi-code/' },
            {
              items: [{ autogenerate: { directory: 'kimi-code/getting-started' } }],
              label: 'Getting Started',
            },
            { label: 'Changelog', link: '/kimi-code/changelog/' },
            { label: 'Contributing', link: '/kimi-code/contributing/' },
          ],
          label: 'Kimi Code',
        },
        {
          collapsed: true,
          items: [
            { label: 'Overview', link: '/claude-code/' },
            {
              items: [{ autogenerate: { directory: 'claude-code/getting-started' } }],
              label: 'Getting Started',
            },
            { label: 'Changelog', link: '/claude-code/changelog/' },
            { label: 'Contributing', link: '/claude-code/contributing/' },
          ],
          label: 'Claude Code',
        },
        {
          collapsed: true,
          items: [
            { label: 'Overview', link: '/codex/' },
            {
              items: [{ autogenerate: { directory: 'codex/getting-started' } }],
              label: 'Getting Started',
            },
            { label: 'Changelog', link: '/codex/changelog/' },
            { label: 'Contributing', link: '/codex/contributing/' },
          ],
          label: 'Codex',
        },
        {
          collapsed: true,
          items: [
            { label: 'Overview', link: '/cursor/' },
            {
              items: [{ autogenerate: { directory: 'cursor/getting-started' } }],
              label: 'Getting Started',
            },
            { label: 'Changelog', link: '/cursor/changelog/' },
            { label: 'Contributing', link: '/cursor/contributing/' },
          ],
          label: 'Cursor',
        },
        {
          collapsed: true,
          items: [
            { label: 'Overview', link: '/pi-omp/' },
            {
              items: [{ autogenerate: { directory: 'pi-omp/getting-started' } }],
              label: 'Getting Started',
            },
            { label: 'Reference', link: '/pi-omp/reference/' },
            { label: 'Changelog', link: '/pi-omp/changelog/' },
            { label: 'Contributing', link: '/pi-omp/contributing/' },
          ],
          label: '@maestria/pi & OMP via plugin',
        },
        {
          collapsed: true,
          items: [
            { label: 'Overview', link: '/hermes/' },
            {
              items: [{ autogenerate: { directory: 'hermes/getting-started' } }],
              label: 'Getting Started',
            },
            { label: 'Commands', link: '/hermes/commands/' },
            { label: 'Changelog', link: '/hermes/changelog/' },
            { label: 'Contributing', link: '/hermes/contributing/' },
          ],
          label: 'Hermes',
        },
      ],
      social: [
        {
          href: 'https://github.com/agustinusnathaniel/maestria',
          icon: 'github',
          label: 'GitHub',
        },
      ],
      title: 'maestria',
    }),
  ],
  site: 'https://maestria.sznm.dev',
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('src', import.meta.url)) },
    },
  },
});
