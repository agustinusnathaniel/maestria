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
            'Portable AI engineering praxis plugins for OpenCode and beyond. ' +
            'Includes @maestria/opencode with 8 agents and global rules injection.',
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
      head: [
        {
          tag: 'meta',
          attrs: {
            property: 'og:title',
            content: 'Maestria — Portable AI Engineering Praxis Plugins',
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
          label: '@maestria/opencode',
          items: [
            { label: 'Overview', link: '/opencode/' },
            {
              label: 'Getting Started',
              items: [{ autogenerate: { directory: 'opencode/getting-started' } }],
            },
            { label: 'Workflow Patterns', link: '/opencode/guide/workflow-patterns/' },
            {
              label: 'Agents',
              items: [{ label: 'Agent Reference', link: '/opencode/agents/' }],
            },
            { label: 'Changelog', link: '/opencode/changelog/' },
            { label: 'Contributing', link: '/opencode/contributing/' },
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
          ],
        },
      ],
    }),
  ],
});
