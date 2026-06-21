import { defineConfig } from 'vite-plus';

export default defineConfig({
  staged: {
    '*.{ts,js,tsx,mjs,mts,cjs}': 'vp check --fix',
  },
  fmt: {
    semi: true,
    singleQuote: true,
    sortPackageJson: true,
    ignorePatterns: ['dist/**', '.changeset/**'],
  },
  lint: {
    ignorePatterns: ['dist/**'],
    jsPlugins: [{ name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' }],
    rules: { 'vite-plus/prefer-vite-plus-imports': 'error' },
    options: { typeAware: true, typeCheck: true },
  },
  run: {
    cache: { scripts: true, tasks: true },
  },
  resolve: {
    tsconfigPaths: true,
  },
});
