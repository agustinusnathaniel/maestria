import { defineConfig } from 'vite-plus';

export default defineConfig({
  pack: {
    entry: ['src/index.ts', 'src/tui.tsx'],
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
