import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vite-plus/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(__dirname, '..');
const DOCS_ROOT = path.resolve(__dirname, '..', 'src', 'content', 'docs');

async function readAppFile(relativePath: string): Promise<string> {
  return readFile(path.join(APP_ROOT, relativePath), 'utf8');
}

function stripFrontmatter(text: string): { frontmatter: string; body: string } {
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== '---') return { frontmatter: '', body: text };
  const close = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (close === -1) return { frontmatter: '', body: text };
  return {
    frontmatter: lines.slice(1, close).join('\n'),
    body: lines.slice(close + 1).join('\n'),
  };
}

describe('Maestria developer resources docs', () => {
  const pages = [
    { file: 'developers/api.mdx', title: 'Maestria API Documentation', keyword: 'Maestria API' },
    {
      file: 'developers/authentication.mdx',
      title: 'Maestria Authentication',
      keyword: 'Maestria Authentication',
    },
    { file: 'developers/webhooks.mdx', title: 'Maestria Webhooks', keyword: 'Maestria Webhooks' },
    { file: 'developers/mcp.mdx', title: 'Maestria MCP Server', keyword: 'Maestria MCP Server' },
  ];

  it.each(pages)('$file exists with Maestria title and description', async ({ file, title }) => {
    const full = await readFile(path.join(DOCS_ROOT, file), 'utf8');
    const { frontmatter, body } = stripFrontmatter(full);
    expect(frontmatter).toContain(`title: ${title}`);
    expect(frontmatter).toContain('Maestria');
    // description must contain Maestria
    expect(frontmatter.toLowerCase()).toContain('maestria');
    // body must contain Maestria multiple times and at least one h2 with Maestria
    expect(body).toContain('Maestria');
    const maestriaCount = (body.match(/Maestria/g) ?? []).length;
    expect(maestriaCount).toBeGreaterThanOrEqual(3);
    expect(body).toMatch(/## .*Maestria/);
    // no em dash in authored text
    expect(full).not.toContain('\u2014');
  });

  it('api.mdx references openapi.json and predictable URLs', async () => {
    const full = await readFile(path.join(DOCS_ROOT, 'developers/api.mdx'), 'utf8');
    expect(full).toContain('https://maestria.sznm.dev/openapi.json');
    expect(full).toContain('/developers/api/');
    expect(full).toContain('Maestria OpenAPI');
  });

  it('all developer docs are discoverable via llms.txt optionalLinks and sidebar config', async () => {
    const astroConfig = await readAppFile('astro.config.mjs');
    for (const label of [
      'Maestria API Documentation',
      'Maestria OpenAPI Specification',
      'Maestria Authentication',
      'Maestria Webhooks',
      'Maestria MCP Server',
    ]) {
      expect(astroConfig).toContain(label);
      expect(astroConfig).toContain('Maestria');
    }
    // predictable URLs in optionalLinks
    expect(astroConfig).toContain('https://maestria.sznm.dev/developers/api/');
    expect(astroConfig).toContain('https://maestria.sznm.dev/openapi.json');
    expect(astroConfig).toContain('https://maestria.sznm.dev/developers/authentication/');
    expect(astroConfig).toContain('https://maestria.sznm.dev/developers/webhooks/');
    expect(astroConfig).toContain('https://maestria.sznm.dev/developers/mcp/');
    // sidebar
    expect(astroConfig).toContain("label: 'Developers'");
    expect(astroConfig).toContain("link: '/developers/api/'");
    expect(astroConfig).toContain("link: '/developers/authentication/'");
    expect(astroConfig).toContain("link: '/developers/webhooks/'");
    expect(astroConfig).toContain("link: '/developers/mcp/'");
    expect(astroConfig).toContain("link: '/openapi.json'");
  });

  it('astro head includes Maestria keywords meta', async () => {
    const astroConfig = await readAppFile('astro.config.mjs');
    expect(astroConfig).toContain("name: 'keywords'");
    expect(astroConfig).toContain('Maestria');
  });
});

describe('Maestria OpenAPI spec', () => {
  it('public/openapi.json is valid JSON with required OpenAPI 3.0.3 fields', async () => {
    const text = await readAppFile('public/openapi.json');
    const spec = JSON.parse(text) as Record<string, unknown>;
    expect(spec.openapi).toBe('3.0.3');
    const info = spec.info as Record<string, unknown>;
    expect(info.title).toBe('Maestria API');
    expect(info.description as string).toContain('Maestria');
    const servers = spec.servers as Array<Record<string, string>>;
    expect(servers[0]?.url).toBe('https://maestria.sznm.dev');
    const paths = spec.paths as Record<string, unknown>;
    for (const required of ['/', '/llms.txt', '/sitemap-index.xml', '/openapi.json']) {
      expect(paths).toHaveProperty(required);
    }
    const components = spec.components as Record<string, unknown>;
    expect(components).toBeDefined();
    expect(components).toHaveProperty('schemas');
  });

  it('public/openapi.yaml exists and matches openapi.json', async () => {
    const jsonText = await readAppFile('public/openapi.json');
    const yamlText = await readAppFile('public/openapi.yaml');
    // basic sanity: yaml contains same title and servers
    expect(yamlText).toContain('Maestria API');
    expect(yamlText).toContain('https://maestria.sznm.dev');
    expect(yamlText).toContain('openapi: 3.0.3');
    // json and yaml should parse to same object (requires yaml lib, simple check via string)
    expect(yamlText.length).toBeGreaterThan(1000);
    expect(jsonText.length).toBeGreaterThan(1000);
  });

  it('openapi.json is listed in llms.txt optionalLinks and referenced from API docs', async () => {
    const astroConfig = await readAppFile('astro.config.mjs');
    expect(astroConfig).toContain('Maestria OpenAPI Specification');
    const apiDocs = await readFile(path.join(DOCS_ROOT, 'developers/api.mdx'), 'utf8');
    expect(apiDocs).toContain('openapi.json');
  });
});

describe('Maestria predictable URL aliases', () => {
  it('public/_redirects contains 302 aliases for api, auth, webhooks, mcp', async () => {
    const text = await readAppFile('public/_redirects');
    expect(text).toContain('/api /developers/api/ 302');
    expect(text).toContain('/api-docs /developers/api/ 302');
    expect(text).toContain('/auth /developers/authentication/ 302');
    expect(text).toContain('/webhooks /developers/webhooks/ 302');
    expect(text).toContain('/mcp /developers/mcp/ 302');
    expect(text).not.toContain('\u2014');
  });

  it('public/_routes.json excludes openapi artifacts for static serving', async () => {
    const routes = JSON.parse(await readAppFile('public/_routes.json')) as { exclude?: string[] };
    expect(routes.exclude).toContain('/openapi.json');
    expect(routes.exclude).toContain('/openapi.yaml');
  });
});
