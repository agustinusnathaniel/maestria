import path from 'node:path';
import { defineConfig } from 'vite-plus';

import { projects } from './projects.ts';

const root = path.resolve(import.meta.dirname, '../..');

export default defineConfig({
  root,
  test: {
    isolate: true,
    maxWorkers: 3,
    pool: 'forks',
    projects: projects.map((project) => ({
      extends: path.join(root, project, 'vite.config.ts'),
      root: path.join(root, project),
      test: { isolate: true, name: project, pool: 'forks' },
    })),
  },
});
