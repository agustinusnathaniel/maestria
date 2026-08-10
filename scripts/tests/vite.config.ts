import { defineConfig } from 'vite-plus';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Standalone vitest config for the directive benchmark harness tests. These
// exercise the benchmark utility (scripts/bench-directives.ts) and are kept
// out of the normal package test suites; run them with `pnpm bench:directives:test`.
export default defineConfig({
  test: {
    root: resolve(dirname(fileURLToPath(import.meta.url)), '..', '..'),
    include: ['scripts/tests/**/*.test.ts'],
  },
});
