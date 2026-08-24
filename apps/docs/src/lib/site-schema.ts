/**
 * schema.org JSON-LD builders for the docs site.
 *
 * Pure functions returning plain objects: no Astro or Node imports, safe to
 * bundle anywhere and to serialize with `JSON.stringify` into
 * `<script type="application/ld+json">` tags.
 *
 * Identity policy (owner decision): GitHub is the only contact surface.
 * No emails, phone numbers, or postal addresses — the `address` key is
 * omitted entirely, never null.
 */

export const SITE_URL = 'https://maestria.sznm.dev';

/** Verbatim Starlight `description` from astro.config.mjs. */
export const SITE_DESCRIPTION =
  'Portable AI engineering praxis plugins for OpenCode, Claude Code, Codex CLI, and beyond.';

export const GITHUB_REPO_URL = 'https://github.com/agustinusnathaniel/maestria';
export const GITHUB_ISSUES_URL = `${GITHUB_REPO_URL}/issues`;

/**
 * Author display name, derived from repo metadata per owner decision:
 * the LICENSE header reads "Copyright (c) 2026 Agustinus Nathaniel".
 */
export const AUTHOR_NAME = 'Agustinus Nathaniel';
export const AUTHOR_URL = 'https://github.com/agustinusnathaniel';

/** Organization entity for the site as a whole. */
export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Maestria',
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    logo: `${SITE_URL}/favicon.svg`,
    sameAs: [GITHUB_REPO_URL],
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'technical support',
        url: GITHUB_ISSUES_URL,
        availableLanguage: ['en'],
      },
    ],
  };
}

/** SoftwareApplication entity for the Maestria plugin ecosystem itself. */
export function softwareApplicationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Maestria',
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Node.js 22+',
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    license: `${GITHUB_REPO_URL}/blob/main/LICENSE`,
    author: { '@type': 'Person', name: AUTHOR_NAME, url: AUTHOR_URL },
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    downloadUrl: 'https://www.npmjs.com/package/maestria',
    codeRepository: GITHUB_REPO_URL,
  };
}
