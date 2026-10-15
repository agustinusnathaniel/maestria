import { defineConfig } from 'vite-plus';

export default defineConfig({
  pack: {
    deps: {
      alwaysBundle: [
        '@clack/prompts',
        'citty',
        'effect',
        'jsonc-parser',
        'picocolors',
        'semver',
        'yaml',
      ],
    },
    entry: ['src/index.ts'],
    fixedExtension: false,
    minify: true,
    target: 'node22',
  },
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    // Platform handlers build their run(...) effects at module load, and the platform
    // tests assert on those load-time calls, so keep Vitest 4's mock call history.
    clearMocks: false,
    include: ['tests/**/*.test.ts'],
  },
});
