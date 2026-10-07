import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

import type { StageResult } from './graph.ts';
import { isRecord, readEvidence } from './artifacts.ts';

const validEvents = (value: unknown): value is StageResult[] =>
  Array.isArray(value) &&
  value.every(
    (event: unknown) =>
      isRecord(event) &&
      typeof event.name === 'string' &&
      ['passed', 'failed', 'blocked'].includes(String(event.state)) &&
      Array.isArray(event.needs) &&
      event.needs.every((name: unknown) => typeof name === 'string') &&
      typeof event.ended === 'number' &&
      (event.started === undefined || typeof event.started === 'number'),
  );

const out = path.resolve(import.meta.dirname, '../../artifacts/ci-proof/probes');
const evidence = [];
for (const failedStage of ['build', 'workspace-tests', 'docs']) {
  const child = spawnSync(
    process.execPath,
    [path.join(import.meta.dirname, 'run.ts'), '--probe', failedStage],
    { encoding: 'utf-8' },
  );
  writeFileSync(path.join(out, failedStage, 'aggregate.log'), `${child.stdout}\n${child.stderr}`);
  assert.equal(child.status, 1);
  const results = readEvidence(path.join(out, failedStage, 'events.json'), validEvents);
  assert.equal(results.find((result) => result.name === failedStage)?.exitCode, 23);
  assert.equal(
    results.every((result) => result.state === 'passed'),
    false,
  );
  assert.equal(results.find((result) => result.name === 'bun')?.state, 'blocked');
  for (const result of results.filter((item) => item.started !== undefined)) {
    for (const dependency of result.needs) {
      const prerequisite = results.find((item) => item.name === dependency);
      assert.equal(prerequisite?.state, 'passed');
      assert.ok(prerequisite.ended <= (result.started ?? 0));
    }
  }
  evidence.push({
    aggregateExitCode: child.status,
    blocked: results.filter((result) => result.state === 'blocked').map((result) => result.name),
    childExitCode: results.find((result) => result.name === failedStage)?.exitCode,
    failedStage,
    prerequisiteOrdering: true,
  });
}
writeFileSync(path.join(out, 'summary.json'), JSON.stringify(evidence, null, 2));
