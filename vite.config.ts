import { defineConfig } from 'vite-plus';

export default defineConfig({
  staged: {
    '*.{ts,js,tsx,mjs,mts,cjs}': 'vp check --fix',
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
        cache: false,
      },
    },
    cache: { scripts: true, tasks: true },
  },
  resolve: {
    tsconfigPaths: true,
  },
});
