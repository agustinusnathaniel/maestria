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
            'Portable AI engineering praxis plugins for OpenCode and Kimi Code. ' +
            'Includes @maestria/opencode (8 agents, global rules injection) and ' +
            '@maestria/kimi-code (8 skills, swarm-aware orchestration, no build step).',
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
          label: '@maestria/kimi-code',
          items: [
            { label: 'Overview', link: '/kimi-code/' },
            {
              label: 'Getting Started',
              items: [{ autogenerate: { directory: 'kimi-code/getting-started' } }],
            },
            { label: 'Workflow Patterns', link: '/kimi-code/guide/workflow-patterns/' },
            {
              label: 'Skills',
              items: [{ label: 'Skill Reference', link: '/kimi-code/skills/' }],
            },
            { label: 'Changelog', link: '/kimi-code/changelog/' },
            { label: 'Contributing', link: '/kimi-code/contributing/' },
          ],
        },
      ],
    }),
  ],
});
