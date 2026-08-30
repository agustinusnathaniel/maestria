import { defineConfig } from 'vite-plus';
import oxfmtPreset from 'ultracite/oxfmt';
import oxlintPreset from 'ultracite/oxlint/core';

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
        'packages/*/prompts/**',
        'packages/*/rules/**',
        'packages/**/skills/**',
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
    },
    overrides: [
      ...(oxlintPreset.overrides ?? []),
      {
        files: ['**/*.test.ts', '**/*.test.tsx'],
        rules: {
          'max-lines': 'off',
          'max-lines-per-function': 'off',
        },
      },
    ],
    options: { typeAware: true, typeCheck: true },
  },
  resolve: {
    tsconfigPaths: true,
  },
  run: {
    cache: { scripts: true, tasks: true },
    tasks: {
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
