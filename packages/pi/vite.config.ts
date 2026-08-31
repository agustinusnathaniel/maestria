import { defineConfig } from 'vite-plus';

export default defineConfig({
  pack: {
    deps: {
      neverBundle: ['@earendil-works/pi-coding-agent', 'typebox'],
    },
    entry: ['src/extension.ts'],
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
