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

  it('emits a minimal PostalAddress for AI verification (country/locality only)', () => {
    // Updated policy: minimal address (no street) for schema completeness
    // and AI legitimacy verification, preserving privacy. See organizationEntity comment.
    const json = JSON.stringify(schema);
    expect('address' in schema).toBe(true);
    expect(schema.address).toEqual({
      '@type': 'PostalAddress',
      addressCountry: 'ID',
      addressLocality: 'Indonesia',
    });
    expect(json).toContain('"address"');
    expect(json).toContain('"PostalAddress"');
  });

  it('emits no street, email, or telephone data anywhere', () => {
    const json = JSON.stringify(schema);
    expect(json).not.toContain('streetAddress');
    expect(json.toLowerCase()).not.toContain('mailto:');
    expect(json.toLowerCase()).not.toContain('"email"');
    expect(json.toLowerCase()).not.toContain('telephone');
    // Locality is now expected via minimal PostalAddress
    expect(schema.address.addressLocality).toBe('Indonesia');
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
    const publisher = schema.publisher;
    expect(publisher['@type']).toBe('Organization');
    expect('@context' in publisher).toBe(false);
    expect(publisher.name).toBe('Maestria');
    expect(publisher.url).toBe(SITE_URL);
  });

  it('publishes exactly the organizationSchema entity (single source)', () => {
    const org = organizationSchema();
    expect(schema.publisher).toEqual({
      '@type': org['@type'],
      name: org.name,
      url: org.url,
      description: org.description,
      logo: org.logo,
      sameAs: org.sameAs,
      address: org.address,
      contactPoint: org.contactPoint,
    });
  });
});

describe('JSON-LD serialization round-trip', () => {
  it.each([
    ['organization', organizationSchema()],
    ['softwareApplication', softwareApplicationSchema()],
    ['website', websiteSchema()],
  ])('%j survives JSON.stringify -> parse unchanged', (_name, schema) => {
    const roundTripped = JSON.parse(JSON.stringify(schema));
    expect(roundTripped).toEqual(schema);
  });
});
