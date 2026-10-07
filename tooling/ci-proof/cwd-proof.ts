import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { isRecord } from './artifacts.ts';

const root = path.resolve(import.meta.dirname, '../..');
const out = path.join(root, 'artifacts/ci-proof/cwd');
mkdirSync(out, { recursive: true });
const evidence = [];
for (const variant of ['baseline', 'candidate']) {
  const cwd = variant === 'baseline' ? path.join(root, 'apps/maestria-cli') : root;
  const filename = path.join(out, `${variant}-workers.jsonl`);
  writeFileSync(filename, '');
  const args = [
    'exec',
    'vp',
    'test',
    'run',
    'setup.test.ts',
    'update.test.ts',
    '--reporter=json',
    `--outputFile=${path.join(out, `${variant}-results.json`)}`,
  ];
  if (variant === 'candidate') {
    args.push('--config', 'tooling/ci-proof/vitest.config.ts', '--project', 'apps/maestria-cli');
  }
  const child = spawnSync('pnpm', args, {
    cwd,
    encoding: 'utf-8',
    env: {
      ...process.env,
      CI_PROOF_CWD_LOG: filename,
      NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import=${path.join(import.meta.dirname, 'cwd-observer.ts')}`,
    },
  });
  writeFileSync(path.join(out, `${variant}.log`), `${child.stdout}\n${child.stderr}`);
  assert.equal(child.status, 0);
  const rows: unknown[] = readFileSync(filename, 'utf-8')
    .trim()
    .split('\n')
    .map((line: string): unknown => JSON.parse(line));
  const workers = rows
    .filter(isRecord)
    .filter(
      (row) =>
        Array.isArray(row.argv) &&
        row.argv.some(
          (arg: unknown) => typeof arg === 'string' && arg.endsWith('/dist/workers/forks.js'),
        ),
    );
  assert.ok(workers.length > 0);
  assert.ok(workers.every((worker) => worker.cwd === cwd));
  evidence.push({ variant, workerCwds: workers.map((worker) => worker.cwd) });
}
writeFileSync(path.join(out, 'summary.json'), JSON.stringify(evidence, null, 2));
