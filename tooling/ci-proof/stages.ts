import path from 'node:path';

import type { Stage } from './graph.ts';

const root = path.resolve(import.meta.dirname, '../..');
const pnpm = (name: string, args: string[], needs: string[] = [], cwd = root): Stage => ({
  command: ['pnpm', ...args],
  cwd,
  name,
  needs,
});
const task = (name: string, taskName: string, needs: string[] = []) =>
  pnpm(name, ['exec', 'vp', 'run', taskName], needs);

export const stages: Stage[] = [
  pnpm('build', ['build:ci']),
  pnpm('astro', ['sync:docs']),
  task('format', 'check-fmt'),
  task('sync', 'check-sync'),
  task('manifests', 'check-manifest-versions'),
  task('python-static', 'check-python'),
  task('root-versions', 'test-sync-plugin-versions'),
  {
    command: [
      'bash',
      '-c',
      "PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=src python3 -m unittest discover -b -s tests -p 'test_*.py'",
    ],
    cwd: path.join(root, 'packages/hermes'),
    name: 'python-tests',
    needs: [],
  },
  pnpm('opencode-pack', ['exec', 'vp', 'pack'], ['build'], path.join(root, 'packages/opencode')),
  pnpm('prime-pack', ['exec', 'vp', 'pack'], ['build'], path.join(root, 'packages/prime-agent')),
  task('lint', 'check-lint', ['build', 'astro']),
  pnpm(
    'workspace-tests',
    [
      'exec',
      'vp',
      'test',
      'run',
      '--config',
      'tooling/ci-proof/vitest.config.ts',
      '--reporter=default',
      '--reporter=json',
      '--outputFile=artifacts/ci-proof/candidate-workspace-results.json',
    ],
    ['build', 'opencode-pack', 'prime-pack'],
  ),
  pnpm('docs', ['exec', 'vp', 'run', '--filter', '@maestria/docs', 'build'], ['lint']),
];
stages.push({
  command: [
    'bun',
    '-e',
    `
    const mod = await import('./packages/opencode/dist/index.js');
    const plugin = await mod.MaestriaPlugin({}, {});
    const hooks = Object.keys(plugin).sort().join(',');
    if (hooks !== 'chat.message,config,experimental.chat.system.transform,experimental.session.compacting')
      throw new Error('Unexpected hooks: ' + hooks);
    console.log('OK opencode plugin loaded in Bun: ' + hooks);
  `,
  ],
  cwd: root,
  name: 'bun',
  needs: stages.map((stage) => stage.name),
});
