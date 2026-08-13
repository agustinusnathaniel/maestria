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
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
  },
  integrations: [
    starlight({
      title: 'Maestria',
      description:
        'Portable AI engineering praxis plugins for OpenCode, Claude Code, Codex CLI, and beyond.',
      customCss: ['./src/styles/global.css'],
      plugins: [
        starlightLinksValidator(),
        starlightLlmsTxt({
          projectName: 'maestria',
          description:
            'Portable AI engineering praxis plugins for OpenCode, Claude Code, Kimi Code, Cursor, Pi, and Hermes. ' +
            'Includes @maestria/opencode (8 agents, global rules injection), ' +
            '@maestria/claude-code (declarative Claude Code plugin with specialist agents, ' +
            'orchestrator and global-rules skills, and fein/sonar/blitz workflow commands), ' +
            '@maestria/codex (provisional Codex CLI skills projection with specialist workflows, ' +
            'orchestration, handoffs, and review contracts), ' +
            '@maestria/kimi-code (8 skills, swarm-aware orchestration, no build step), ' +
            '@maestria/cursor (Cursor IDE & CLI plugin with specialist agents), ' +
            '@maestria/pi (full agent orchestration for Pi Coding Agent), and ' +
            '@maestria/hermes (methodology layer for Hermes Agent), and ' +
            '@maestria/omp / Oh My Pi (the Pi Coding Agent launcher, session manager, and UX).',
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
            property: 'og:title',
            content: 'Maestria - Portable AI Engineering Praxis Plugins',
          },
        },
        {
          tag: 'meta',
          attrs: {
            property: 'og:description',
            content:
              'Installable, self-wiring plugins that encode effective AI engineering workflows.',
          },
        },
        {
          tag: 'meta',
          attrs: { name: 'twitter:card', content: 'summary_large_image' },
        },
        {
          tag: 'link',
          attrs: { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
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
            { label: 'Overview', link: '/codex-cli/' },
            {
              label: 'Getting Started',
              items: [{ autogenerate: { directory: 'codex-cli/getting-started' } }],
            },
            { label: 'Changelog', link: '/codex-cli/changelog/' },
            { label: 'Contributing', link: '/codex-cli/contributing/' },
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
      ],
    }),
  ],
});
