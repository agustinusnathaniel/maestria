import oxfmtPreset from 'ultracite/oxfmt';
import oxlintPreset from 'ultracite/oxlint/core';
import { defineConfig } from 'vite-plus';

import { testOverrides } from './tooling/lint/test-overrides.js';

export default defineConfig({
  fmt: {
    // Ultracite oxfmt preset as base - via vite-plus hybrid (ADR-CORE-021).
    // Spread first so repo overrides win. Keep single authority in vite.config.ts,
    // no standalone oxfmt.config.ts.
    ...oxfmtPreset,
    // ── Intentional repo style overrides (not incremental) ───────
    ignorePatterns: [
      ...new Set([
        ...(oxfmtPreset.ignorePatterns ?? []),
        'dist/**',
        '.changeset/**',
        'packages/*/agents/**',
        'packages/*/commands/**',
        'packages/*/prompts/**',
        'packages/*/rules/**',
        'packages/**/skills/**',
        'packages/*/SYSTEM.md',
        '.agents',
        'CHANGELOG.md',
      ]),
    ],
    overrides: [
      ...(oxfmtPreset.overrides ?? []),
      {
        files: ['packages/core/**/*.md'],
        options: {
          proseWrap: 'never',
        },
      },
      {
        files: ['**/*.md'],
        options: {
          proseWrap: 'never',
        },
      },
    ],
    // Preset printWidth 80 vs repo 100: keep 100 to avoid MD reflow in docs (intentional).
    printWidth: 100,
    semi: true,
    // Preset singleQuote false (double); repo intentionally uses single.
    singleQuote: true,
    // Preset sortImports enabled (alphabetical); repo keeps disabled - import order is intentional.
    sortImports: false,
    // Preset sortPackageJson is true - keep as-is (no churn observed).
    sortPackageJson: true,
    // Preset trailingComma 'es5'; repo style uses 'all' (intentional).
    trailingComma: 'all',
  },
  lint: {
    // Ultracite oxlint/core preset as base - via vite-plus hybrid (ADR-CORE-021).
    // Spread first so repo rules win. No standalone oxlint.config.ts.
    ...oxlintPreset,
    ignorePatterns: [...new Set([...(oxlintPreset.ignorePatterns ?? []), 'dist/**'])],
    jsPlugins: [{ name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' }],
    options: { typeAware: true, typeCheck: true },
    overrides: [...(oxlintPreset.overrides ?? []), testOverrides],
    plugins: [...(oxlintPreset.plugins ?? [])],
    rules: {
      ...oxlintPreset.rules,
      // Strict Ultracite core preset - only intentional project overrides remain (see ADR-021)
      curly: 'error',
      'max-lines': ['error', { max: 500, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 60, skipBlankLines: true, skipComments: true }],
      'sort-imports': [
        'warn',
        {
          allowSeparatedGroups: true,
          ignoreCase: true,
          ignoreDeclarationSort: true,
        },
      ],
      'vite-plus/prefer-vite-plus-imports': 'error',
    },
  },
  resolve: {
    tsconfigPaths: true,
  },
  run: {
    cache: { scripts: true, tasks: true },
    tasks: {
      '@maestria/docs#build': {
        cache: true,
        command: 'astro build',
        // Astro writes and reads .astro during build (cooperative thrashing) -> always miss.
        // Exclude .astro from fingerprint and archive only dist to enable cache hit.
        // See https://viteplus.dev/guide/automatic-data-tracking#override-inputs-and-outputs
        input: [{ auto: true }, '!**/.astro/**', '!.astro/**', '!dist/**'],
        output: ['dist/**'],
      },
      'check-fmt': {
        cache: true,
        command: 'vp fmt --check',
        // fmt is input-heavy but doesn't need build outputs; exclude dist to stabilize cache
        input: [{ auto: true }, '!dist/**', '!**/.astro/**', '!.astro/**'],
        output: [],
      },
      'check-lint': {
        cache: true,
        command: 'vp lint',
        // type-aware lint needs build outputs, so this task must run after build
        // Cache on source + lint config; dist is excluded but lint still fingerprint sources
        input: [
          { auto: true },
          '!dist/**',
          '!**/.astro/**',
          '!.astro/**',
          'vite.config.ts',
          'tooling/lint/**',
          'tsconfig.json',
          'packages/*/tsconfig.json',
          'apps/*/tsconfig.json',
        ],
        output: [],
      },
      'check-manifest-versions': {
        cache: true,
        command: 'pnpm exec tsx scripts/sync-plugin-versions.ts --check',
        input: [
          'scripts/sync-plugin-versions.ts',
          'packages/*/package.json',
          'packages/*/plugin.json',
          'packages/*/.claude-plugin/plugin.json',
          'packages/*/.codex-plugin/plugin.json',
          'packages/*/.cursor-plugin/plugin.json',
          'packages/*/kimi.plugin.json',
          'packages/hermes/plugin.yaml',
          'packages/hermes/src/maestria_hermes/_version.py',
        ],
        output: [],
      },
      'check-python': {
        cache: true,
        command: 'ruff check packages/hermes/src && python3 -m compileall -q packages/hermes/src',
        input: ['packages/hermes/src/**/*.py', 'packages/hermes/pyproject.toml'],
        output: [],
      },
      'check-sync': {
        cache: true,
        command: 'bash scripts/check-sync',
        input: [
          { auto: false },
          'scripts/check-sync',
          'packages/core/scripts/**/*.ts',
          'packages/core/agent-directives/**/*.md',
          'packages/*/sync.config.ts',
        ],
        output: [
          'packages/*/agents/**',
          'packages/*/commands/**',
          'packages/*/prompts/**',
          'packages/*/rules/**',
          'packages/**/skills/**',
          'packages/*/SYSTEM.md',
        ],
      },
      'test-sync-plugin-versions': {
        cache: true,
        command: 'pnpm exec vitest run scripts/sync-plugin-versions.test.ts',
        input: ['scripts/sync-plugin-versions.ts', 'scripts/sync-plugin-versions.test.ts'],
        output: [],
      },
    },
  },
  staged: {
    '*.{ts,md,mdx,js,tsx,mjs,mts,cjs}': 'vp check --fix',
  },
});
