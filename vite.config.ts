import { defineConfig } from 'vite-plus';

export default defineConfig({
  staged: {
    '*.{ts,md,mdx,js,tsx,mjs,mts,cjs}': 'vp check --fix',
  },
  fmt: {
    semi: true,
    singleQuote: true,
    sortPackageJson: true,
    ignorePatterns: [
      'dist/**',
      '.changeset/**',
      'packages/*/agents/**',
      'packages/*/prompts/**',
      'packages/*/rules/**',
      'packages/*/skills/**',
      '.agents',
      'CHANGELOG.md',
    ],
    overrides: [
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
    ignorePatterns: ['dist/**'],
    jsPlugins: [{ name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' }],
    rules: { 'vite-plus/prefer-vite-plus-imports': 'error' },
    options: { typeAware: true, typeCheck: true },
  },
  run: {
    tasks: {
      'check-sync': {
        command: 'bash scripts/check-sync',
        cache: true,
        input: [
          { auto: false },
          'scripts/check-sync',
          'packages/core/scripts/**/*.ts',
          'packages/core/agent-directives/**/*.md',
          'packages/*/sync.config.ts',
        ],
        output: ['packages/*/agents/**', 'packages/*/prompts/**', 'packages/*/rules/**'],
      },
      'check-python': {
        command: 'python3 scripts/check-python.py',
        cache: true,
        input: ['packages/hermes/src/**/*.py', 'scripts/check-python.py'],
        output: [],
      },
    },
    cache: { scripts: true, tasks: true },
  },
  resolve: {
    tsconfigPaths: true,
  },
});
