import { defineConfig } from 'vite-plus';

export default defineConfig({
  pack: {
    entry: ['src/extension.ts'],
    minify: true,
    target: 'node22',
  },
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
