import { defineConfig } from 'vite-plus';

export default defineConfig({
  pack: {
    entry: ['src/extension.ts'],
    minify: true,
    sourcemap: true,
    target: 'node22',
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
