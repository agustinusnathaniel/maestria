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
      // Ultracite core preset with minimal project overrides - strict mode per ADR-021.
      // Only intentional maestria rules plus deferred high-churn type safety remain.
      'vite-plus/prefer-vite-plus-imports': 'error',
      'max-lines': ['error', { max: 500, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 60, skipBlankLines: true, skipComments: true }],
      curly: 'error',

      // ── Deferred: type-aware safety (high churn, requires type refactoring) ──
      // Kept off with counts from strict run (~3115 errors total). Fix incrementally
      // in follow-up PRs to avoid risky bulk type changes in this toolchain upgrade.
      'typescript/no-unsafe-type-assertion': 'off', // 478 - needs type guards
      'typescript/no-explicit-any': 'off', // 314 - widespread any in tests/scripts
      'typescript/no-unsafe-assignment': 'off', // 259
      'typescript/no-unsafe-member-access': 'off', // 225
      'typescript/no-unsafe-argument': 'off', // 207
      'typescript/no-non-null-assertion': 'off', // 171 - ! assertions
      'typescript/no-unsafe-call': 'off', // 130
      'typescript/strict-boolean-expressions': 'off', // 110 - explicit boolean checks
      'typescript/no-unsafe-return': 'off', // 5
      'typescript/no-unnecessary-type-assertion': 'off', // 83 originally, now low

      // ── Deferred: high-churn stylistic (require manual review, low safety value) ──
      // Kept off to reach 0 lint after strict preset migration; fix incrementally per follow-up.
      'unicorn/filename-case': 'off', // 10 - Astro components use PascalCase intentionally
      'require-unicode-regexp': 'off', // 259 - add /u to all regex, needs unicode compatibility review
      'func-style': 'off', // 403 - function declaration vs expression, changes hoisting, 403 files
      'prefer-named-capture-group': 'off', // 58 - named capture groups, high churn regex
      'prefer-destructuring': 'off', // 89 - prefer object destructuring, high churn
      'no-await-in-loop': 'off', // 46 - await in loop, common in scripts, needs Promise.all refactor
      'unicorn/import-style': 'off', // 39 - default vs named import for node:path, requires call site changes
      'no-inline-comments': 'off', // 38 - inline comments, style only
      'typescript/method-signature-style': 'off', // 35 - method vs property signature
      'sort-keys': 'off', // 28 - object key alphabetical ordering, 28 violations but high churn if fully strict
      'no-use-before-define': 'off', // 24 - function hoisting order
      'func-names': 'off', // 21 - require function names
      'no-nested-ternary': 'off', // 14
      'typescript/no-invalid-void-type': 'off', // 14
      'typescript/consistent-type-imports': 'off', // 13
      'typescript/consistent-return': 'off', // 11
      'unicorn/no-await-expression-member': 'off', // 10
      'unicorn/consistent-function-scoping': 'off', // 9
      'unicorn/no-array-for-each': 'off', // 6
      'import/first': 'off', // 6
      'no-shadow': 'off', // 5
      'typescript/no-dynamic-delete': 'off', // 5
      'typescript/strict-void-return': 'off', // 5
      'no-useless-return': 'off', // 4
      'no-implicit-globals': 'off', // 4
      'jsdoc/check-tag-names': 'off', // 4 - @maestria tags flagged
      'promise/prefer-await-to-then': 'off', // 3
      'require-await': 'off', // 3
      'unicorn/prefer-ternary': 'off', // 3
      'unicorn/no-anonymous-default-export': 'off', // 3
      'unicorn/no-immediate-mutation': 'off', // 2
      complexity: 'off', // 2
      'no-loop-func': 'off', // 2
      'promise/prefer-await-to-callbacks': 'off', // 2
      'unicorn/no-array-reduce': 'off', // 1
      'unicorn/no-nested-ternary': 'off', // 1
      'no-useless-concat': 'off', // 1
      'unicorn/prefer-query-selector': 'off', // 1
      'typescript/prefer-string-starts-ends-with': 'off', // 1
      'typescript/no-confusing-void-expression': 'off', // 1 - buggy autofix for Effect.as(void 0)
      'no-unused-vars': 'off', // 31 - unused vars after autofix, needs manual cleanup
      'no-void': 'off', // 24 - void operator
      'no-plusplus': 'off', // 19 - ++ operator
      'unicorn/no-array-sort': 'off', // 16 - require sort compare function
      'typescript/prefer-nullish-coalescing': 'off', // 9 - || vs ?? behavior change risk
      'no-empty-function': 'off', // 7 - empty functions
      'typescript/non-nullable-type-assertion-style': 'off', // 3
      'typescript/no-unnecessary-type-conversion': 'off', // 3
      'unicorn/prefer-logical-operator-over-ternary': 'off', // 2
      'unicorn/prefer-structured-clone': 'off', // 2
      'unicorn/prefer-single-call': 'off', // 1
      'no-useless-constructor': 'off', // 1
      'unicorn/prefer-code-point': 'off', // 1
      'typescript/no-unnecessary-type-parameters': 'off', // 1
      'unicorn/no-useless-undefined': 'off', // 8 - useless undefined, conflicts with Effect.succeed(undefined)
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
