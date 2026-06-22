import { defineConfig } from 'vite-plus';

export default defineConfig({
  pack: {
    entry: ['src/extension.ts'],
    target: 'node22',
    sourcemap: true,
    minify: true,
    external: ['@earendil-works/pi-coding-agent', '@earendil-works/pi-ai', 'typebox'],
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    tsconfigPaths: true,
  },
});
