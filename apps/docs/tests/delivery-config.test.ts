import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vite-plus/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(__dirname, '..');

async function readAppFile(relativePath: string): Promise<string> {
  return readFile(path.join(APP_ROOT, relativePath), 'utf8');
}

/** The Vary value must keep HTML and markdown responses out of shared caches. */
function assertVary(value: string | undefined, source: string): void {
  expect(value, `Vary header missing in ${source}`).toBeDefined();
  const names = (value ?? '').split(',').map((entry) => entry.trim().toLowerCase());
  expect(names).toContain('accept');
  expect(names).toContain('accept-encoding');
}

describe('Cloudflare Pages _headers', () => {
  it('sets Vary: Accept, Accept-Encoding on the catch-all block', async () => {
    const text = await readAppFile('public/_headers');
    const match = /^\s*Vary:\s*(.+)$/im.exec(text);
    assertVary(match?.[1], 'public/_headers');
  });

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

describe('netlify.toml', () => {
  it('sets Vary: Accept, Accept-Encoding in the global headers block', async () => {
    const text = await readAppFile('netlify.toml');
    const match = /^\s*Vary\s*=\s*"([^"]+)"/m.exec(text);
    assertVary(match?.[1], 'netlify.toml');
  });
});

describe('vercel.json', () => {
  interface VercelHeader {
    key?: string;
    value?: string;
  }
  interface VercelConfig {
    headers?: { headers?: VercelHeader[] }[];
  }

  it('sets Vary: Accept, Accept-Encoding on a route-wide header set', async () => {
    const config = JSON.parse(await readAppFile('vercel.json')) as VercelConfig;
    const vary = config.headers
      ?.flatMap((rule) => rule.headers ?? [])
      .find((header) => header.key?.toLowerCase() === 'vary');
    assertVary(vary?.value, 'vercel.json');
  });
});

describe('Cloudflare Pages _routes.json', () => {
  it('invokes the function only where needed: include all, exclude verified static paths', async () => {
    const routes = JSON.parse(await readAppFile('public/_routes.json')) as {
      version?: number;
      include?: string[];
      exclude?: string[];
    };

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
    const routes = JSON.parse(await readAppFile('public/_routes.json')) as { exclude?: string[] };
    for (const artifact of [
      '/llms.txt',
      '/llms-full.txt',
      '/llms-small.txt',
      '/sitemap-index.xml',
    ]) {
      expect(routes.exclude).toContain(artifact);
    }
  });
});
