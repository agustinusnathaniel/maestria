import assert from 'node:assert/strict';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { isRecord, readEvidence } from './artifacts.ts';
import type { StageResult } from './graph.ts';
import { stages } from './stages.ts';

const root = path.resolve(import.meta.dirname, '../..');
const out = path.join(root, 'artifacts/ci-proof');
const validResults = (value: unknown): value is StageResult[] =>
  Array.isArray(value) &&
  value.every(
    (item: unknown) =>
      isRecord(item) &&
      typeof item.name === 'string' &&
      item.state === 'passed' &&
      item.exitCode === 0 &&
      typeof item.started === 'number' &&
      typeof item.ended === 'number',
  );
const results = readEvidence(path.join(out, 'candidate-dag/results.json'), validResults);
assert.deepEqual(
  results.map((result) => result.name).toSorted(),
  stages.map((stage) => stage.name).toSorted(),
);
for (const stage of stages) {
  const result = results.find((item) => item.name === stage.name);
  assert.ok(result);
  for (const name of stage.needs) {
    const prerequisite = results.find((item) => item.name === name);
    assert.ok(prerequisite);
    assert.ok(prerequisite.ended <= (result.started ?? 0), `${name} must precede ${stage.name}`);
  }
}
const events = results
  .flatMap((result) => [
    { change: 1, time: result.started ?? 0 },
    { change: -1, time: result.ended },
  ])
  .toSorted((a, b) => a.time - b.time || a.change - b.change);
let active = 0;
let maximum = 0;
for (const event of events) {
  active += event.change;
  maximum = Math.max(maximum, active);
}
assert.ok(maximum <= 4);
const pythonFiles = readdirSync(path.join(root, 'packages/hermes/tests'))
  .filter((name) => /^test_.*\.py$/u.test(name))
  .toSorted();
assert.equal(pythonFiles.length, 5);
const summary = (filename: string) => {
  const text = readFileSync(filename, 'utf-8');
  return {
    outcome: /(?:^|\n)(?<outcome>OK(?: \(skipped=\d+\))?)(?:\n|$)/u.exec(text)?.groups?.outcome,
    tests: /Ran \d+ tests/u.exec(text)?.at(0),
  };
};
const baselinePython = summary(path.join(out, 'baseline-check-final.log'));
const candidatePython = summary(path.join(out, 'candidate-dag/python-tests.log'));
assert.ok(baselinePython.tests !== undefined && baselinePython.outcome !== undefined);
assert.deepEqual(candidatePython, baselinePython);
const docs = results.find((result) => result.name === 'docs');
const tests = results.find((result) => result.name === 'workspace-tests');
const evidence = {
  allStagesPassed: true,
  docsTestOverlap: (docs?.started ?? Infinity) < (tests?.ended ?? 0),
  maximumStageChildren: maximum,
  prerequisiteOrdering: true,
  python: { files: pythonFiles, summary: candidatePython },
  stages: results.length,
};
writeFileSync(path.join(out, 'dag-verification.json'), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
