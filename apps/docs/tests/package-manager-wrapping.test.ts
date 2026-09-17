import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vite-plus/test';

const __dirname = import.meta.dirname;
const DOCS_ROOT = path.resolve(__dirname, '..', 'src', 'content', 'docs');

// Changelogs are historical records and contributing docs pin pnpm, so both
// stay outside the package-manager wrapping convention.
const WRAPPING_EXCLUSIONS = /(?:changelog|contributing)\.mdx$/u;
const FENCED_CODE_BLOCK = /```[a-zA-Z]*\n(?<body>[\s\S]*?)```/gu;
const RUNNER_PREFIXED_MAESTRIA = /^\s*(?:npx|pnpx|bunx|yarn dlx|deno x|nlx)\s+maestria\b/mu;

const readContentSources = async () => {
  const entries = await readdir(DOCS_ROOT, { recursive: true });
  const files = entries.filter((file) => file.endsWith('.mdx'));
  return await Promise.all(
    files.map(async (file) => ({
      file,
      source: await readFile(path.join(DOCS_ROOT, file), 'utf-8'),
    })),
  );
};

const presentsRawCommand = (source: string): boolean =>
  [...source.matchAll(FENCED_CODE_BLOCK)].some((block) =>
    RUNNER_PREFIXED_MAESTRIA.test(block.groups?.body ?? ''),
  );

describe('package-manager command wrapping', () => {
  it('presents runner-prefixed maestria commands through AllPackageManagers', async () => {
    const sources = await readContentSources();
    const violations = sources
      .filter(({ file }) => !WRAPPING_EXCLUSIONS.test(file))
      .filter(({ source }) => presentsRawCommand(source))
      .map(({ file }) => file);

    expect(violations).toEqual([]);
  });

  it('imports the shared AllPackageManagers wrapper', async () => {
    const sources = await readContentSources();
    const violations = sources
      .filter(({ source }) => source.includes("from 'starlight-package-managers'"))
      .map(({ file }) => file);

    expect(violations).toEqual([]);
  });
});
