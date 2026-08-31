import { defineConfig } from 'vite-plus';

export default defineConfig({
  pack: {
    deps: {
      neverBundle: ['@oh-my-pi/pi-coding-agent'],
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
