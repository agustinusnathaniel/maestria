import { describe, expect, it } from 'vite-plus/test';

import {
  GITHUB_ISSUES_URL,
  GITHUB_REPO_URL,
  SITE_DESCRIPTION,
  SITE_URL,
  organizationSchema,
  softwareApplicationSchema,
} from '../src/lib/site-schema.ts';

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

  it('routes technical support through GitHub issues', () => {
    const contact = schema.contactPoint[0];
    expect(contact['@type']).toBe('ContactPoint');
    expect(contact.contactType).toBe('technical support');
    expect(contact.url).toBe(GITHUB_ISSUES_URL);
    expect(contact.availableLanguage).toContain('en');
  });

  it('omits address entirely (GitHub-only identity policy)', () => {
    // Never null: the key must be absent so serialized JSON-LD carries no
    // empty postal data.
    expect('address' in schema).toBe(false);
    expect(JSON.stringify(schema)).not.toContain('"address"');
  });

  it('contains no email, telephone, or postal data anywhere', () => {
    const json = JSON.stringify(schema);
    expect(json).not.toContain('@type":"PostalAddress');
    expect(json.toLowerCase()).not.toContain('mailto:');
    expect('telephone' in schema).toBe(false);
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

describe('JSON-LD serialization round-trip', () => {
  it.each([
    ['organization', organizationSchema()],
    ['softwareApplication', softwareApplicationSchema()],
  ])('%j survives JSON.stringify -> parse unchanged', (_name, schema) => {
    const roundTripped = JSON.parse(JSON.stringify(schema));
    expect(roundTripped).toEqual(schema);
  });
});
