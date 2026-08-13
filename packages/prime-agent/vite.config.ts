import { defineConfig } from 'vite-plus';

export default defineConfig({
  pack: {
    entry: ['src/extension.ts'],
    target: 'node22',
    sourcemap: true,
    minify: true,
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
