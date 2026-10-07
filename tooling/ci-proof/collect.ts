import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { projects } from './projects.ts';

const root = path.resolve(import.meta.dirname, '../..');
const [variant] = process.argv.slice(2);
if (!variant || !['baseline', 'candidate'].includes(variant)) {
  throw new Error('Expected baseline or candidate');
}
const out = path.join(root, 'artifacts/ci-proof', variant);
mkdirSync(out, { recursive: true });
const commands: { args: string[]; cwd: string; exitCode: number | null; error?: string }[] = [];

const run = (args: string[], cwd: string, name: string) => {
  const result = spawnSync('pnpm', args, { cwd, encoding: 'utf-8' });
  writeFileSync(path.join(out, `${name}.log`), `${result.stdout}\n${result.stderr}`);
  commands.push({ args, cwd, error: result.error?.message, exitCode: result.status });
  writeFileSync(path.join(out, 'commands.json'), JSON.stringify(commands, null, 2));
  if (result.status !== 0 || result.error) {
    throw new Error(`${name} failed: ${result.status}`);
  }
};

const collect = (
  args: string[],
  cwd: string,
  name: string,
  filters: string[] = [],
  options: string[] = [],
) => {
  run(
    [...args, 'list', ...filters, ...options, '--json', path.join(out, `${name}-list.json`)],
    cwd,
    `${name}-list`,
  );
  run(
    [
      ...args,
      'run',
      ...filters,
      ...options,
      '--reporter=json',
      `--outputFile=${path.join(out, `${name}-results.json`)}`,
    ],
    cwd,
    `${name}-results`,
  );
};

if (variant === 'baseline') {
  for (const project of projects) {
    const cwd = path.join(root, project);
    if (['packages/opencode', 'packages/prime-agent'].includes(project)) {
      run(['exec', 'vp', 'pack'], cwd, `${project.replaceAll('/', '-')}-pack`);
    }
    collect(['exec', 'vp', 'test'], cwd, project.replaceAll('/', '-'));
  }
} else {
  collect(
    ['exec', 'vp', 'test'],
    root,
    'workspace',
    [],
    ['--config', 'tooling/ci-proof/vitest.config.ts'],
  );
}
collect(['exec', 'vitest'], root, 'root-versions', ['scripts/sync-plugin-versions.test.ts']);
