import { access, readFile } from 'node:fs/promises';
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

async function exists(relativePath: string): Promise<boolean> {
  try {
    await access(path.join(APP_ROOT, relativePath));
    return true;
  } catch {
    return false;
  }
}

describe('Maestria developer resources honest docs', () => {
  it('developers/overview.mdx exists with Maestria title and description', async () => {
    const full = await readFile(path.join(DOCS_ROOT, 'developers/overview.mdx'), 'utf8');
    const { frontmatter, body } = stripFrontmatter(full);
    expect(frontmatter).toContain('title: Maestria Developer Resources');
    expect(frontmatter).toContain('Maestria');
    expect(frontmatter.toLowerCase()).toContain('maestria');
    // body must contain Maestria multiple times and at least one h2 with Maestria
    expect(body).toContain('Maestria');
    const maestriaCount = (body.match(/Maestria/g) ?? []).length;
    expect(maestriaCount).toBeGreaterThanOrEqual(5);
    expect(body).toMatch(/## .*Maestria/);
    expect(full).not.toContain('\u2014');
  });

  it('overview documents CLI, docs consumption, CodeGraph MCP, support, and non-services', async () => {
    const full = await readFile(path.join(DOCS_ROOT, 'developers/overview.mdx'), 'utf8');
    expect(full).toContain('/cli/getting-started/');
    expect(full).toContain('/cli/commands/');
    expect(full).toContain('llms.txt');
    expect(full).toContain('.md');
    expect(full).toContain('/sitemap-index.xml');
    expect(full).toContain('/ecosystem/codegraph/');
    expect(full).toContain('https://github.com/agustinusnathaniel/maestria');
    expect(full).toContain('https://www.npmjs.com/package/maestria');
    // honest non-service disclosure
    expect(full).toContain('No hosted');
    expect(full.toLowerCase()).toContain('no hosted');
    expect(full).toContain('No Maestria webhooks');
    expect(full).toContain('No Maestria-hosted authentication');
    // must not fabricate REST API
    expect(full).not.toContain('Maestria API Documentation');
    expect(full).not.toContain('Maestria OpenAPI');
  });

  it('is discoverable via llms.txt optionalLinks and sidebar config', async () => {
    const astroConfig = await readAppFile('astro.config.mjs');
    // honest link must exist
    expect(astroConfig).toContain('Maestria Developer Resources');
    expect(astroConfig).toContain('https://maestria.sznm.dev/developers/overview/');
    expect(astroConfig).toContain(
      'CLI, CodeGraph MCP, and how to consume Maestria docs as an agent.',
    );
    // sidebar single entry
    expect(astroConfig).toContain("label: 'Developers'");
    expect(astroConfig).toContain("link: '/developers/overview/'");
    // must not contain fabricated developer links
    expect(astroConfig).not.toContain('Maestria API Documentation');
    expect(astroConfig).not.toContain('Maestria OpenAPI Specification');
    expect(astroConfig).not.toContain('Maestria Authentication');
    expect(astroConfig).not.toContain("label: 'Maestria Webhooks'");
    expect(astroConfig).not.toContain("label: 'Maestria MCP Server'");
    expect(astroConfig).not.toContain("link: '/developers/api/'");
    expect(astroConfig).not.toContain("link: '/developers/authentication/'");
    expect(astroConfig).not.toContain("link: '/developers/webhooks/'");
    expect(astroConfig).not.toContain("link: '/developers/mcp/'");
    expect(astroConfig).not.toContain("link: '/openapi.json'");
    // predictable URLs for fabricated resources must not be in optionalLinks
    expect(astroConfig).not.toContain('https://maestria.sznm.dev/developers/api/');
    expect(astroConfig).not.toContain('https://maestria.sznm.dev/openapi.json');
    expect(astroConfig).not.toContain('https://maestria.sznm.dev/developers/authentication/');
    expect(astroConfig).not.toContain('https://maestria.sznm.dev/developers/webhooks/');
    expect(astroConfig).not.toContain('https://maestria.sznm.dev/developers/mcp/');
  });

  it('astro head includes Maestria keywords meta', async () => {
    const astroConfig = await readAppFile('astro.config.mjs');
    expect(astroConfig).toContain("name: 'keywords'");
    expect(astroConfig).toContain('Maestria');
  });

  it('does not ship fabricated OpenAPI specs', async () => {
    expect(await exists('public/openapi.json')).toBe(false);
    expect(await exists('public/openapi.yaml')).toBe(false);
  });

  it('does not ship fabricated redirect aliases', async () => {
    const hasRedirects = await exists('public/_redirects');
    if (hasRedirects) {
      const text = await readAppFile('public/_redirects');
      expect(text).not.toContain('/api /developers/api/');
      expect(text).not.toContain('/auth /developers/authentication/');
      expect(text).not.toContain('/webhooks /developers/webhooks/');
      expect(text).not.toContain('/mcp /developers/mcp/');
    } else {
      expect(hasRedirects).toBe(false);
    }
  });

  it('public/_routes.json does not exclude openapi artifacts', async () => {
    const routes = JSON.parse(await readAppFile('public/_routes.json')) as { exclude?: string[] };
    expect(routes.exclude).not.toContain('/openapi.json');
    expect(routes.exclude).not.toContain('/openapi.yaml');
    // honest excludes still present
    expect(routes.exclude).toContain('/llms.txt');
    expect(routes.exclude).toContain('/sitemap-index.xml');
  });

  it('only honest developers doc exists', async () => {
    expect(await exists('src/content/docs/developers/overview.mdx')).toBe(true);
    expect(await exists('src/content/docs/developers/api.mdx')).toBe(false);
    expect(await exists('src/content/docs/developers/authentication.mdx')).toBe(false);
    expect(await exists('src/content/docs/developers/webhooks.mdx')).toBe(false);
    expect(await exists('src/content/docs/developers/mcp.mdx')).toBe(false);
  });
});
