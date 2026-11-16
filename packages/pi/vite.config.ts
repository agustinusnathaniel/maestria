import { defineConfig } from 'vite-plus';

import { forceRerunTriggers } from '../../tooling/test/force-rerun-triggers.js';

export default defineConfig({
  pack: {
    deps: {
      neverBundle: ['@earendil-works/pi-coding-agent', 'typebox'],
    },
    entry: ['src/extension.ts'],
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
