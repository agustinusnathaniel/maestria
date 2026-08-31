import { defineConfig } from 'vite-plus';
import oxfmtPreset from 'ultracite/oxfmt';
import oxlintPreset from 'ultracite/oxlint/core';

import { narrowOverrides } from './tooling/lint/narrow.js';
import { stylisticDebt, stylisticDebtFiles } from './tooling/lint/stylistic-debt.js';
import { testOverrides } from './tooling/lint/test-overrides.js';

export default defineConfig({
  fmt: {
    // Ultracite oxfmt preset as base - via vite-plus hybrid (ADR-CORE-021).
    // Spread first so repo overrides win. Keep single authority in vite.config.ts,
    // no standalone oxfmt.config.ts.
    ...oxfmtPreset,
    // ── Intentional repo style overrides (not incremental) ───────
    // Preset printWidth 80 vs repo 100: keep 100 to avoid MD reflow in docs (intentional).
    printWidth: 100,
    // Preset singleQuote false (double); repo intentionally uses single.
    singleQuote: true,
    // Preset sortImports enabled (alphabetical); repo keeps disabled - import order is intentional.
    sortImports: false,
    // Preset trailingComma 'es5'; repo style uses 'all' (intentional).
    trailingComma: 'all',
    // Preset sortPackageJson is true - keep as-is (no churn observed).
    sortPackageJson: true,
    semi: true,
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
  },
  lint: {
    // Ultracite oxlint/core preset as base - via vite-plus hybrid (ADR-CORE-021).
    // Spread first so repo rules win. No standalone oxlint.config.ts.
    ...oxlintPreset,
    ignorePatterns: [...new Set([...(oxlintPreset.ignorePatterns ?? []), 'dist/**'])],
    plugins: [...(oxlintPreset.plugins ?? [])],
    jsPlugins: [{ name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' }],
    rules: {
      ...oxlintPreset.rules,
      // Strict Ultracite core preset - only intentional project overrides remain (see ADR-021)
      'vite-plus/prefer-vite-plus-imports': 'error',
      'max-lines': ['error', { max: 500, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 60, skipBlankLines: true, skipComments: true }],
      curly: 'error',
      // func-style 'expression' churns 392 files with low safety value (arrow vs function
      // declaration is stylistic). Defer to last - keep off as single intentional exception
      // pending codemod. See task notes: prioritize type-safe rules over stylistic.
      'func-style': 'off',
      // import-style 'default import for node:path' churns 25 files requiring `import path` + `path.join` refactor
      // with low safety value (named vs default is stylistic). Keep off as second intentional exception.
      'unicorn/import-style': 'off',
      // sort-keys 'object keys should be sorted' churns 28 files with low safety (alphabetical key order
      // is stylistic, not safety). Keep off as third intentional exception (within <2 beyond func-style budget is 2, this is second).
      'sort-keys': 'off',
    },
    overrides: [
      ...(oxlintPreset.overrides ?? []),
      testOverrides,
      ...narrowOverrides,
      { files: stylisticDebtFiles, ...stylisticDebt },
    ],
    options: { typeAware: true, typeCheck: true },
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
          'packages/claude-code/.claude-plugin/plugin.json',
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
        output: ['packages/*/agents/**', 'packages/*/prompts/**', 'packages/*/rules/**'],
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
