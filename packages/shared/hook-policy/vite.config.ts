import { defineConfig } from 'vite-plus';

import { forceRerunTriggers } from '../../../tooling/test/force-rerun-triggers.js';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    forceRerunTriggers,
    include: ['tests/**/*.test.ts'],
  },
});
