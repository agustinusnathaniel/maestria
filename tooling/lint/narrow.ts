import type { OxlintOverride } from 'vite-plus/lint';

// Narrow file-specific relaxations for intentional stylistic patterns in src
// (low safety value, high churn - prefer fixing would require extensive refactor).
// Keep narrow to avoid global offs beyond the 2-budget (import-style, sort-keys).

export const narrowOverrides = [
  {
    files: ['apps/maestria-cli/src/lib/platforms.ts', 'apps/maestria-cli/src/commands/**/*.ts'],
    rules: {
      'no-await-in-loop': 'off',
      'prefer-named-capture-group': 'off',
      'func-names': 'off',
      'no-nested-ternary': 'off',
      'unicorn/no-nested-ternary': 'off',
    },
  },
  {
    files: ['packages/shared/pi/src/**/*.ts', 'packages/prime-agent/src/**/*.ts'],
    rules: {
      'typescript/method-signature-style': 'off',
    },
  },
  {
    files: ['packages/shared/pi/src/tools-core.ts'],
    rules: {
      'typescript/no-unsafe-type-assertion': 'off',
    },
  },
  {
    files: [
      'apps/maestria-cli/src/lib/codex-instructions.ts',
      'apps/maestria-cli/src/lib/codex-agent-files.ts',
      'apps/maestria-cli/src/commands/uninstall.ts',
      'apps/maestria-cli/src/commands/install.ts',
      'apps/maestria-cli/src/commands/update.ts',
      'apps/maestria-cli/src/lib/model-config.ts',
      'scripts/sync-plugin-versions.ts',
      'apps/docs/functions/[[path]].ts',
    ],
    rules: {
      'no-use-before-define': 'off',
    },
  },
  {
    files: ['**/*.astro'],
    rules: {
      'unicorn/filename-case': 'off',
    },
  },
  {
    files: [
      'apps/maestria-cli/src/lib/group-multiselect.ts',
      'packages/opencode/src/index.ts',
      'packages/opencode/src/modes/**',
      'packages/omp/src/subagent.ts',
      'packages/pi/src/subagent.ts',
    ],
    rules: {
      'typescript/no-explicit-any': 'off',
      'typescript/no-unsafe-assignment': 'off',
      'typescript/no-unsafe-argument': 'off',
      'typescript/no-unsafe-call': 'off',
      'typescript/no-unsafe-member-access': 'off',
      'typescript/no-unsafe-return': 'off',
      'typescript/no-unsafe-type-assertion': 'off',
      'unicorn/no-array-reduce': 'off',
      'unicorn/no-array-for-each': 'off',
      'typescript/consistent-return': 'off',
      'typescript/no-invalid-void-type': 'off',
    },
  },
  {
    files: [
      'packages/prime-agent/src/pi-api.ts',
      'packages/prime-agent/src/modes.ts',
      'packages/omp/src/rules.ts',
      'packages/pi/src/rules.ts',
      'packages/pi/src/tools-core.ts',
      'apps/maestria-cli/src/lib/install-one.ts',
      'apps/maestria-cli/src/commands/uninstall.ts',
      'apps/maestria-cli/src/commands/update.ts',
    ],
    rules: {
      'typescript/no-invalid-void-type': 'off',
      'typescript/strict-void-return': 'off',
    },
  },
  {
    files: [
      'apps/maestria-cli/src/lib/shell.ts',
      'apps/maestria-cli/src/lib/model-config.ts',
      'packages/core/scripts/lib/config.ts',
      'apps/maestria-cli/src/lib/platforms.ts',
    ],
    rules: {
      'typescript/no-unsafe-assignment': 'off',
      'typescript/no-unsafe-member-access': 'off',
      'typescript/no-unsafe-argument': 'off',
      'typescript/no-unsafe-return': 'off',
      'typescript/strict-void-return': 'off',
    },
  },
  {
    files: [
      'apps/maestria-cli/src/lib/group-multiselect.ts',
      'packages/pi/src/subagent-polling.ts',
    ],
    rules: {
      'typescript/method-signature-style': 'off',
    },
  },
  {
    files: ['apps/docs/**/*.astro', 'apps/docs/src/components/**/*.astro'],
    rules: {
      'unicorn/no-array-for-each': 'off',
      'promise/prefer-await-to-then': 'off',
      'no-inline-comments': 'off',
      'no-implicit-globals': 'off',
      'typescript/consistent-return': 'off',
      'typescript/no-non-null-assertion': 'off',
    },
  },
  // Narrow file-specific relaxation for configure.ts hint computation:
  // `agent as keyof AgentModels` is safe after runtime check; broader
  // `no-unsafe-type-assertion` is now enforced elsewhere, so this file
  // gets a targeted off instead of the previous broad suppression.
  {
    files: ['apps/maestria-cli/src/commands/configure.ts'],
    rules: {
      'typescript/no-unsafe-type-assertion': 'off',
    },
  },
  {
    files: ['packages/shared/pi/src/tools-core.ts'],
    rules: {
      'typescript/unbound-method': 'off',
    },
  },
] satisfies OxlintOverride[];
