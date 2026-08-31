import type { OxlintOverride } from 'vite-plus/lint';

// Incremental broad suppression (tracked debt, not strict enforcement):
// This override covers ~13 src globs with ~38 rules off and effectively acts
// as a global via patterns. It is intentional incremental debt for low-value
// stylistic and low-safety rules (func-names, complexity, max-lines,
// destructuring, ternaries, await-in-loop, etc.) that would otherwise churn
// many files. Safety-critical rules like `typescript/no-unsafe-type-assertion`
// have been removed from this broad block and are now handled via narrow
// file-specific overrides or inline SAFETY comments. Tracked for follow-up:
// tighten further as codemods land. Do not add new rules here without ADR.
// Per VitePlus monorepo guide https://viteplus.dev/guide/monorepo
// "Composing Configuration Files", this debt is isolated in tooling/lint/
// and composed via imports (see ADR-CORE-021). For monorepo sharing
// alternatives, see https://oxc.rs/docs/guide/usage/linter/nested-config.html#monorepo-pattern-share-a-base-config-with-extends
// (overrides vs extends).

export const stylisticDebtFiles: OxlintOverride['files'] = [
  'apps/maestria-cli/src/lib/**/*.ts',
  'apps/maestria-cli/src/commands/**/*.ts',
  'apps/maestria-cli/src/**/*.ts',
  'apps/maestria-cli/**/*.ts',
  'packages/pi/src/**/*.ts',
  'packages/omp/src/**/*.ts',
  'packages/prime-agent/src/**/*.ts',
  'packages/shared/pi/src/**/*.ts',
  'packages/core/scripts/lib/**/*.ts',
  'apps/docs/src/pages/**/*.astro',
  'apps/docs/functions/**/*.ts',
  'packages/opencode/src/**/*.ts',
  'scripts/**/*.ts',
];

export const stylisticDebt = {
  rules: {
    'func-names': 'off',
    'typescript/consistent-return': 'off',
    'no-nested-ternary': 'off',
    'unicorn/no-nested-ternary': 'off',
    'no-use-before-define': 'off',
    complexity: 'off',
    'eslint/complexity': 'off',
    'typescript/no-dynamic-delete': 'off',
    'no-shadow': 'off',
    'no-await-in-loop': 'off',
    'jsdoc/check-tag-names': 'off',
    'no-implicit-globals': 'off',
    'unicorn/prefer-ternary': 'off',
    'unicorn/no-anonymous-default-export': 'off',
    'require-await': 'off',
    'eslint/require-await': 'off',
    'typescript/require-await': 'off',
    'typescript/promise-function-async': 'off',
    'typescript/strict-boolean-expressions': 'off',
    'prefer-destructuring': 'off',
    'eslint/prefer-destructuring': 'off',
    'typescript/consistent-type-imports': 'off',
    'typescript/method-signature-style': 'off',
    'typescript/no-unnecessary-type-assertion': 'off',
    'typescript/no-unnecessary-type-conversion': 'off',
    'no-loop-func': 'off',
    'no-inline-comments': 'off',
    'unicorn/no-immediate-mutation': 'off',
    'promise/prefer-await-to-callbacks': 'off',
    'promise/prefer-await-to-then': 'off',
    'unicorn/no-array-for-each': 'off',
    'unicorn/no-array-reduce': 'off',
    'unicorn/prefer-query-selector': 'off',
    'unicorn/no-useless-undefined': 'off',
    'no-useless-return': 'off',
    'prefer-named-capture-group': 'off',
    'max-lines': 'off',
    'max-lines-per-function': 'off',
  },
} satisfies Omit<OxlintOverride, 'files'>;
