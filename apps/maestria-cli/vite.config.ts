import { defineConfig } from 'vite-plus';

export default defineConfig({
  pack: {
    deps: {
      alwaysBundle: ['@clack/prompts', 'citty', 'effect', 'jsonc-parser', 'picocolors'],
    },
    entry: ['src/index.ts'],
    fixedExtension: false,
    minify: true,
    sourcemap: true,
    target: 'node22',
  },
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
