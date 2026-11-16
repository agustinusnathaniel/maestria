import { defineConfig } from 'vite-plus';

import { forceRerunTriggers } from '../../tooling/test/force-rerun-triggers.js';

export default defineConfig({
  pack: {
    entry: ['src/index.ts'],
    fixedExtension: false,
    minify: true,
    target: 'node22',
  },
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    forceRerunTriggers,
    include: ['tests/**/*.test.ts'],
  },
});
