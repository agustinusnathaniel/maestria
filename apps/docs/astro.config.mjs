import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import starlightAutoSidebar from 'starlight-auto-sidebar';
import starlightLinksValidator from 'starlight-links-validator';
import starlightLlmsTxt from 'starlight-llms-txt';
import starlightPageActions from 'starlight-page-actions';

export default defineConfig({
  site: 'https://maestria.sznm.dev',
  integrations: [
    starlight({
      title: 'Maestria',
      description: 'Portable AI engineering praxis plugins for OpenCode and beyond.',
      customCss: ['./src/styles/global.css'],
      plugins: [
        starlightLinksValidator(),
        starlightLlmsTxt({
          projectName: 'maestria',
          description:
            'Portable AI engineering praxis plugins for OpenCode, Kimi Code, and Pi. ' +
            'Includes @maestria/opencode (8 agents, global rules injection), ' +
            '@maestria/kimi-code (8 skills, swarm-aware orchestration, no build step), and ' +
            '@maestria/pi (full agent orchestration for Pi Coding Agent).',
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
            { label: 'Specialist Reference', link: '/core/agents/' },
            { label: 'Pipeline & Roles', link: '/core/pipeline/' },
            { label: 'How It Works', link: '/core/how-it-works/' },
            { label: 'Workflow Patterns', link: '/core/workflow-patterns/' },
            { label: 'Contributing', link: '/core/contributing/' },
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
          label: '@maestria/pi',
          collapsed: true,
          items: [
            { label: 'Overview', link: '/pi/' },
            {
              label: 'Getting Started',
              items: [{ autogenerate: { directory: 'pi/getting-started' } }],
            },
            { label: 'Pi Reference', link: '/pi/reference/' },
            { label: 'Changelog', link: '/pi/changelog/' },
            { label: 'Contributing', link: '/pi/contributing/' },
          ],
        },
      ],
    }),
  ],
});
