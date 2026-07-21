import { defineConfig } from 'vite-plus';

export default defineConfig({
  pack: {
    entry: ['src/extension.ts'],
    target: 'node22',
    sourcemap: true,
    minify: true,
    deps: {
      neverBundle: ['@oh-my-pi/pi-coding-agent'],
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    tsconfigPaths: true,
  },
});
