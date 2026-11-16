import { configDefaults } from 'vite-plus/test/config';

/**
 * `vp test --changed <ref>` runs only the test files that import a changed file. A changed file
 * matching one of these globs runs every test file instead, because tests reach it without
 * importing it. Every package's test config uses this list.
 */
export const forceRerunTriggers = [
  ...configDefaults.forceRerunTriggers,
  // Skills, agents, prompts, docs, manifests and the lockfile: anything that is not a JS or TS
  // module. Tests read these from disk.
  '**/!(*.@(ts|tsx|mts|cts|js|jsx|mjs|cjs))',
  // hooks.test.ts runs the hook scripts with node, and packed-artifact.test.ts packs the package.
  '**/packages/agent-plugins/**',
  // sync.test.ts runs the sync script with tsx.
  '**/packages/core/scripts/**',
];
