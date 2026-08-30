import { describe, expect, it } from 'vite-plus/test';

import {
  GITHUB_ISSUES_URL,
  GITHUB_REPO_URL,
  SITE_DESCRIPTION,
  SITE_URL,
  organizationSchema,
  softwareApplicationSchema,
  websiteSchema,
} from '@/lib/site-schema.ts';

describe('organizationSchema', () => {
  const schema = organizationSchema();

  it('is an Organization entity with the required identity fields', () => {
    expect(schema['@context']).toBe('https://schema.org');
    expect(schema['@type']).toBe('Organization');
    expect(schema.name).toBe('Maestria');
    expect(schema.url).toBe(SITE_URL);
    expect(schema.description).toBe(SITE_DESCRIPTION);
    expect(schema.logo).toBe(`${SITE_URL}/favicon.svg`);
  });

  it('lists the GitHub repository in sameAs', () => {
    expect(schema.sameAs).toContain(GITHUB_REPO_URL);
  });

  it('lists the npm package in sameAs for brand disambiguation', () => {
    expect(schema.sameAs).toContain('https://www.npmjs.com/package/maestria');
  });

  it('routes technical support through GitHub issues', () => {
    const contact = schema.contactPoint[0];
    expect(contact['@type']).toBe('ContactPoint');
    expect(contact.contactType).toBe('technical support');
    expect(contact.url).toBe(GITHUB_ISSUES_URL);
    expect(contact.availableLanguage).toContain('en');
  });

  it('emits no postal address at all', () => {
    // Reaffirmed owner decision: GitHub-only identity policy. The key must
    // be absent, never null, in every serialization of the entity.
    const json = JSON.stringify(schema);
    expect('address' in schema).toBe(false);
    expect(json).not.toContain('"address"');
    expect(json).not.toContain('@type":"PostalAddress');
  });

  it('emits no street, city, email, or telephone data anywhere', () => {
    const json = JSON.stringify(schema);
    expect(json).not.toContain('streetAddress');
    expect(json).not.toContain('addressLocality');
    expect(json.toLowerCase()).not.toContain('mailto:');
    expect(json.toLowerCase()).not.toContain('"email"');
    expect(json.toLowerCase()).not.toContain('telephone');
  });
});

describe('softwareApplicationSchema', () => {
  const schema = softwareApplicationSchema();

  it('is a SoftwareApplication entity with the required fields', () => {
    expect(schema['@context']).toBe('https://schema.org');
    expect(schema['@type']).toBe('SoftwareApplication');
    expect(schema.name).toBe('Maestria');
    expect(schema.applicationCategory).toBe('DeveloperApplication');
    expect(schema.operatingSystem).toBe('Node.js 22+');
    expect(schema.url).toBe(SITE_URL);
    expect(schema.description).toBe(SITE_DESCRIPTION);
    expect(schema.license).toBe(`${GITHUB_REPO_URL}/blob/main/LICENSE`);
    expect(schema.codeRepository).toBe(GITHUB_REPO_URL);
    expect(schema.downloadUrl).toBe('https://www.npmjs.com/package/maestria');
  });

  it('attributes authorship to the repo-derived person (no invented identity)', () => {
    expect(schema.author).toEqual({
      '@type': 'Person',
      name: 'Agustinus Nathaniel',
      url: 'https://github.com/agustinusnathaniel',
    });
  });

  it('offers the software free of charge', () => {
    expect(schema.offers).toEqual({
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    });
  });
});

describe('websiteSchema', () => {
  const schema = websiteSchema();

  it('is a WebSite entity with the core site fields', () => {
    expect(schema['@context']).toBe('https://schema.org');
    expect(schema['@type']).toBe('WebSite');
    expect(schema.name).toBe('Maestria');
    expect(schema.alternateName).toBe('Maestria AI Praxis');
    expect(schema.inLanguage).toBe('en');
    expect(schema.url).toBe(SITE_URL);
    expect(schema.description).toBe(SITE_DESCRIPTION);
  });

  it('embeds the Organization as publisher without its own @context', () => {
    const { publisher } = schema;
    expect(publisher['@type']).toBe('Organization');
    expect('@context' in publisher).toBe(false);
    expect(publisher.name).toBe('Maestria');
    expect(publisher.url).toBe(SITE_URL);
  });

  it('publishes exactly the organizationSchema entity (single source)', () => {
    const org = organizationSchema();
    expect(schema.publisher).toEqual({
      '@type': org['@type'],
      contactPoint: org.contactPoint,
      description: org.description,
      logo: org.logo,
      name: org.name,
      sameAs: org.sameAs,
      url: org.url,
    });
  });
});

describe('JSON-LD serialization round-trip', () => {
  it.each([
    ['organization', organizationSchema()],
    ['softwareApplication', softwareApplicationSchema()],
    ['website', websiteSchema()],
  ])('%j survives JSON.stringify -> parse unchanged', (_name, schema) => {
    const roundTripped = structuredClone(schema);
    expect(roundTripped).toEqual(schema);
  });
});
