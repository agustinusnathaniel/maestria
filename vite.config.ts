import oxfmtPreset from 'ultracite/oxfmt';
import oxlintPreset from 'ultracite/oxlint/core';
import { defineConfig } from 'vite-plus';

import { testOverrides } from './tooling/lint/test-overrides.js';

export default defineConfig({
  fmt: {
    // Ultracite oxfmt preset as base - composed in the authoritative Vite+ config.
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
        'packages/agent-plugins/AGENTS.md',
        // Generated skill copies; the canonical core skills stay formatted.
        'packages/*/skills/**',
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
    // Ultracite oxlint/core preset as base - composed in the authoritative Vite+ config.
    // Spread first so repo rules win. No standalone oxlint.config.ts.
    ...oxlintPreset,
    ignorePatterns: [...new Set([...(oxlintPreset.ignorePatterns ?? []), 'dist/**'])],
    jsPlugins: [{ name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' }],
    options: { typeAware: true, typeCheck: true },
    overrides: [...(oxlintPreset.overrides ?? []), testOverrides],
    plugins: [...(oxlintPreset.plugins ?? [])],
    rules: {
      ...oxlintPreset.rules,
      // Strict Ultracite core preset - only intentional project overrides remain (see CONTRIBUTING.md)
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
      'check-full': {
        cache: false,
        command: [
          'vp run lint',
          'vp run test-sync-plugin-versions',
          'vp run test',
          'vp run check-manifest-versions',
        ],
        dependsOn: ['build', 'fmt:check', 'check-sync'],
      },
      // CI splits check-full into two jobs that run in parallel on separate runners:
      // ci-check (format, sync, type-aware lint) and ci-test (tests and manifest checks).
      'ci-check': {
        cache: false,
        command: 'vp run lint',
        // Lint is type-aware: it needs build outputs and the docs app's Astro-generated types.
        dependsOn: ['build:ci', 'fmt:check', 'check-sync', '@maestria/docs#sync'],
      },
      'ci-test': {
        cache: false,
        command: 'vp run test',
        dependsOn: ['build:ci', 'test-sync-plugin-versions', 'check-manifest-versions'],
      },
    },
  },
  staged: {
    '*.{ts,md,mdx,js,tsx,mjs,mts,cjs}': 'vp check --fix',
  },
});
