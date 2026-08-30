import { fileURLToPath } from 'node:url';

import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import starlightAutoSidebar from 'starlight-auto-sidebar';
import starlightLinksValidator from 'starlight-links-validator';
import starlightLlmsTxt from 'starlight-llms-txt';
import starlightPageActions from 'starlight-page-actions';

export default defineConfig({
  site: 'https://maestria.sznm.dev',
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('src', import.meta.url)) },
    },
  },
  integrations: [
    starlight({
      title: 'Maestria',
      description:
        'Portable AI engineering praxis plugins for OpenCode, Claude Code, Codex CLI, and beyond.',
      disable404Route: true,
      customCss: ['./src/styles/global.css'],
      plugins: [
        starlightLinksValidator({
          // The 404 hero's "Go home" action points at `/`, i.e. the custom
          // homepage from src/pages/index.astro, which the validator cannot
          // resolve once the page has a markdown body to scan. Exclude exactly
          // that link value instead of disabling validation for the page.
          exclude: ['/'],
        }),
        starlightLlmsTxt({
          projectName: 'maestria',
          description:
            'Portable AI engineering praxis plugins for OpenCode, Claude Code, Kimi Code, Cursor, Pi, and Hermes. ' +
            'Includes @maestria/opencode (8 agents, global rules injection), ' +
            '@maestria/claude-code (declarative Claude Code plugin with specialist agents, ' +
            'orchestrator and global-rules skills, and fein/sonar/blitz workflow commands), ' +
            '@maestria/codex (Codex CLI skills projection with specialist workflows, ' +
            'orchestration, handoffs, and review contracts), ' +
            '@maestria/kimi-code (8 skills, swarm-aware orchestration, no build step), ' +
            '@maestria/cursor (Cursor IDE & CLI plugin with specialist agents), ' +
            '@maestria/pi (full agent orchestration for Pi Coding Agent), ' +
            '@maestria/hermes (methodology layer for Hermes Agent), ' +
            '@maestria/prime-agent (Maestria methodology for Prime Agent as Agent Skills ' +
            'plus a verified Prime/Pi extension for workflow modes), and ' +
            '@maestria/omp / Oh My Pi (the Pi Coding Agent launcher, session manager, and UX).',
          details:
            'For dedicated usage guidance, installation instructions, and machine-readable resource links, read [Maestria agent instructions](https://maestria.sznm.dev/agents.md).',
          optionalLinks: [
            {
              label: 'Maestria documentation home',
              url: 'https://maestria.sznm.dev/',
            },
            {
              label: 'Maestria When to Use guide',
              url: 'https://maestria.sznm.dev/core/when-to-use/',
            },
            {
              label: 'Maestria CLI getting started',
              url: 'https://maestria.sznm.dev/cli/getting-started/',
              description: 'Install with `npx maestria install <platform>`.',
            },
            {
              label: 'Maestria page Markdown example',
              url: 'https://maestria.sznm.dev/core/when-to-use.md',
              description: 'Every documentation page has a `.md` twin.',
            },
            {
              label: 'Maestria sitemap',
              url: 'https://maestria.sznm.dev/sitemap-index.xml',
            },
            {
              label: 'Maestria robots.txt',
              url: 'https://maestria.sznm.dev/robots.txt',
            },
            {
              label: 'Maestria on npm',
              url: 'https://www.npmjs.com/package/maestria',
            },
            {
              label: 'Maestria source repository',
              url: 'https://github.com/agustinusnathaniel/maestria',
            },
            {
              label: 'Maestria issue tracker',
              url: 'https://github.com/agustinusnathaniel/maestria/issues',
            },
          ],
        }),
        starlightPageActions({
          share: true,
          prompt:
            'You are an expert on the Maestria plugin ecosystem. ' +
            'Read {url} and help me understand how to use these tools ' +
            'effectively.',
        }),
        starlightAutoSidebar(),
      ],
      components: {
        Head: './src/components/StarlightHead.astro',
      },
      head: [
        {
          tag: 'meta',
          attrs: {
            name: 'keywords',
            content:
              'Maestria, Maestria AI engineering praxis, Maestria plugins, OpenCode, Claude Code, Codex CLI, Kimi Code, Cursor, Pi, Hermes',
          },
        },
        {
          tag: 'meta',
          attrs: {
            property: 'og:image',
            content:
              'https://og.sznm.dev/api/generate?heading=maestria&text=Portable%20AI%20Engineering%20Praxis%20Plugins&template=color',
          },
        },
      ],
      social: [
        {
          icon: 'github',
          href: 'https://github.com/agustinusnathaniel/maestria',
          label: 'GitHub',
        },
      ],
      sidebar: [
        {
          label: 'Core Concepts',
          items: [
            { label: 'When to Use Maestria', link: '/core/when-to-use/' },
            { label: 'Specialist Reference', link: '/core/agents/' },
            { label: 'Pipeline & Roles', link: '/core/pipeline/' },
            { label: 'How It Works', link: '/core/how-it-works/' },
            { label: 'Workflow Patterns', link: '/core/workflow-patterns/' },
            { label: 'Contributing', link: '/core/contributing/' },
            { label: 'Contributors', link: '/core/contributors/' },
            { label: 'Changelog', link: '/core/changelog/' },
          ],
        },
        {
          label: 'Project',
          items: [
            { label: 'About', link: '/about/' },
            { label: 'Contact', link: '/contact/' },
            { label: 'Privacy', link: '/privacy/' },
          ],
        },
        {
          label: 'CLI',
          items: [
            { label: 'Overview', link: '/cli/' },
            { label: 'Getting Started', link: '/cli/getting-started/' },
            { label: 'Commands', link: '/cli/commands/' },
            { label: 'Changelog', link: '/cli/changelog/' },
          ],
        },
        {
          label: 'Ecosystem',
          items: [
            { label: 'Overview', link: '/ecosystem/' },
            { label: 'CodeGraph', link: '/ecosystem/codegraph/' },
            { label: 'RTK', link: '/ecosystem/rtk/' },
            { label: 'OpenCode Goal Plugin', link: '/ecosystem/opencode-goal-plugin/' },
          ],
        },
        {
          label: '@maestria/opencode',
          collapsed: true,
          items: [
            { label: 'Overview', link: '/opencode/' },
            {
              label: 'Getting Started',
              items: [{ autogenerate: { directory: 'opencode/getting-started' } }],
            },
            { label: 'Configuration', link: '/opencode/configuration/' },
            { label: 'Reference', link: '/opencode/reference/' },
            { label: 'Changelog', link: '/opencode/changelog/' },
            { label: 'Contributing', link: '/opencode/contributing/' },
          ],
        },
        {
          label: '@maestria/kimi-code',
          collapsed: true,
          items: [
            { label: 'Overview', link: '/kimi-code/' },
            {
              label: 'Getting Started',
              items: [{ autogenerate: { directory: 'kimi-code/getting-started' } }],
            },
            { label: 'Changelog', link: '/kimi-code/changelog/' },
            { label: 'Contributing', link: '/kimi-code/contributing/' },
          ],
        },
        {
          label: '@maestria/claude-code',
          collapsed: true,
          items: [
            { label: 'Overview', link: '/claude-code/' },
            {
              label: 'Getting Started',
              items: [{ autogenerate: { directory: 'claude-code/getting-started' } }],
            },
            { label: 'Changelog', link: '/claude-code/changelog/' },
            { label: 'Contributing', link: '/claude-code/contributing/' },
          ],
        },
        {
          label: '@maestria/codex',
          collapsed: true,
          items: [
            { label: 'Overview', link: '/codex/' },
            {
              label: 'Getting Started',
              items: [{ autogenerate: { directory: 'codex/getting-started' } }],
            },
            { label: 'Changelog', link: '/codex/changelog/' },
            { label: 'Contributing', link: '/codex/contributing/' },
          ],
        },
        {
          label: '@maestria/cursor',
          collapsed: true,
          items: [
            { label: 'Overview', link: '/cursor/' },
            {
              label: 'Getting Started',
              items: [{ autogenerate: { directory: 'cursor/getting-started' } }],
            },
            { label: 'Changelog', link: '/cursor/changelog/' },
            { label: 'Contributing', link: '/cursor/contributing/' },
          ],
        },
        {
          label: '@maestria/pi & @maestria/omp',
          collapsed: true,
          items: [
            { label: 'Overview', link: '/pi-omp/' },
            {
              label: 'Getting Started',
              items: [{ autogenerate: { directory: 'pi-omp/getting-started' } }],
            },
            { label: 'Reference', link: '/pi-omp/reference/' },
            { label: 'Changelog', link: '/pi-omp/changelog/' },
            { label: 'Contributing', link: '/pi-omp/contributing/' },
          ],
        },
        {
          label: '@maestria/hermes',
          collapsed: true,
          items: [
            { label: 'Overview', link: '/hermes/' },
            {
              label: 'Getting Started',
              items: [{ autogenerate: { directory: 'hermes/getting-started' } }],
            },
            { label: 'Commands', link: '/hermes/commands/' },
            { label: 'Changelog', link: '/hermes/changelog/' },
            { label: 'Contributing', link: '/hermes/contributing/' },
          ],
        },
        {
          label: '@maestria/prime-agent',
          collapsed: true,
          items: [
            { label: 'Overview', link: '/prime-agent/' },
            {
              label: 'Getting Started',
              items: [{ autogenerate: { directory: 'prime-agent/getting-started' } }],
            },
            { label: 'Changelog', link: '/prime-agent/changelog/' },
            { label: 'Contributing', link: '/prime-agent/contributing/' },
          ],
        },
      ],
    }),
  ],
});
