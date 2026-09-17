import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vite-plus/test';

const __dirname = import.meta.dirname;
const APP_ROOT = path.resolve(__dirname, '..');

const readAppFile = async (relativePath: string): Promise<string> =>
  await readFile(path.join(APP_ROOT, relativePath), 'utf-8');

interface RoutesConfig {
  version?: number;
  include?: string[];
  exclude?: string[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const isRoutesConfig = (value: unknown): value is RoutesConfig => {
  if (!isRecord(value)) {
    return false;
  }
  return (
    (value.version === undefined || typeof value.version === 'number') &&
    (value.include === undefined || isStringArray(value.include)) &&
    (value.exclude === undefined || isStringArray(value.exclude))
  );
};

const readRoutesConfig = async (): Promise<RoutesConfig> => {
  const parsed: unknown = JSON.parse(await readAppFile('public/_routes.json'));
  if (!isRoutesConfig(parsed)) {
    throw new TypeError('public/_routes.json has an invalid shape');
  }
  return parsed;
};

describe('Cloudflare Pages _headers', () => {
  it('keeps the security headers intact', async () => {
    const text = await readAppFile('public/_headers');
    for (const header of [
      'Strict-Transport-Security:',
      'X-Content-Type-Options:',
      'Content-Security-Policy:',
    ]) {
      expect(text).toContain(header);
    }
  });
});

describe('Cloudflare Pages _routes.json', () => {
  it('invokes the function only where needed: include all, exclude verified static paths', async () => {
    const routes = await readRoutesConfig();

    expect(routes.version).toBe(1);
    expect(routes.include).toEqual(['/*']);
    expect(routes.exclude).toBeDefined();
    expect(routes.exclude).toContain('/_astro/*');

    // Every exclude must be a rooted glob/path; Cloudflare rejects other forms.
    for (const pattern of routes.exclude ?? []) {
      expect(pattern.startsWith('/')).toBe(true);
    }
  });

  it('excludes the prerendered agent artifacts so they are served purely statically', async () => {
    const routes = await readRoutesConfig();
    for (const artifact of [
      '/llms.txt',
      '/llms-full.txt',
      '/llms-small.txt',
      '/agents.md',
      '/robots.txt',
      '/sitemap-index.xml',
    ]) {
      expect(routes.exclude).toContain(artifact);
    }
  });
});

describe('public/robots.txt', () => {
  it('declares one allow-all group and an absolute Sitemap line per RFC 9309', async () => {
    const text = await readAppFile('public/robots.txt');
    // Exact bytes: one group (User-agent + Allow), a blank line, then the
    // Sitemap directive with its absolute URL, and a trailing newline.
    expect(text).toBe(
      [
        'User-agent: *',
        'Allow: /',
        '',
        'Sitemap: https://maestria.sznm.dev/sitemap-index.xml',
        '',
      ].join('\n'),
    );
  });

  it('uses only RFC 9309 directive names with absolute sitemap URLs', async () => {
    const text = await readAppFile('public/robots.txt');
    for (const line of text.split('\n').filter(Boolean)) {
      const [directive] = line.split(':');
      expect(['User-agent', 'Allow', 'Sitemap']).toContain(directive?.trim());
      if (directive?.trim() === 'Sitemap') {
        expect(line).toMatch(/Sitemap: https:\/\//u);
      }
    }
  });
});

describe('public/agents.md', () => {
  it('is a static, self-contained entrypoint for coding agents', async () => {
    const text = await readAppFile('public/agents.md');
    expect(text.startsWith('# Maestria agent instructions\n')).toBe(true);
    expect(text).toContain('npx maestria install <platform>');
    expect(text).toContain('https://maestria.sznm.dev/llms-full.txt');
    expect(text).toContain('https://maestria.sznm.dev/core/when-to-use.md');
    expect(text).toContain('https://github.com/agustinusnathaniel/maestria/issues');
    expect(text).toContain('Cloudflare Pages');
    expect(text).not.toContain('\u2014');
  });
});
