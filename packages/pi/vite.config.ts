import { defineConfig } from 'vite-plus';

export default defineConfig({
  pack: {
    entry: ['src/extension.ts'],
    target: 'node22',
    sourcemap: true,
    minify: true,
    deps: {
      neverBundle: ['@earendil-works/pi-coding-agent', 'typebox'],
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    tsconfigPaths: true,
  },
});
