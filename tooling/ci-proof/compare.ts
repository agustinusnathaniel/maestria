import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

import { projects } from './projects.ts';
import { isRecord, readEvidence } from './artifacts.ts';

interface CollectedTest {
  file: string;
  name: string;
}
interface TestFileResult {
  name: string;
  assertionResults: { fullName: string; status: string }[];
}
interface Report {
  success: boolean;
  testResults: TestFileResult[];
}

const root = path.resolve(import.meta.dirname, '../..');
const out = path.join(root, 'artifacts/ci-proof');
const baselineNames = [...projects.map((project) => project.replaceAll('/', '-')), 'root-versions'];
const candidateNames = ['workspace', 'root-versions'];
const validReport = (value: unknown): value is Report =>
  isRecord(value) &&
  typeof value.success === 'boolean' &&
  Array.isArray(value.testResults) &&
  value.testResults.every(
    (file: unknown) =>
      isRecord(file) &&
      typeof file.name === 'string' &&
      Array.isArray(file.assertionResults) &&
      file.assertionResults.every(
        (test: unknown) =>
          isRecord(test) && typeof test.fullName === 'string' && typeof test.status === 'string',
      ),
  );
const validCollection = (value: unknown): value is CollectedTest[] =>
  Array.isArray(value) &&
  value.every(
    (test: unknown) =>
      isRecord(test) && typeof test.file === 'string' && typeof test.name === 'string',
  );
const reports = (variant: string, names: string[]) =>
  names.flatMap((name) => {
    const report = readEvidence(path.join(out, variant, `${name}-results.json`), validReport);
    assert.equal(report.success, true, `${variant}/${name}`);
    return report.testResults;
  });
const collected = (variant: string, names: string[]) =>
  names.flatMap((name) =>
    readEvidence(path.join(out, variant, `${name}-list.json`), validCollection),
  );
const identities = (files: TestFileResult[]) =>
  files
    .flatMap((file) =>
      file.assertionResults.map((test) => [
        path.relative(root, file.name),
        test.fullName,
        test.status,
      ]),
    )
    .map((identity) => JSON.stringify(identity))
    .toSorted();
const listIdentities = (tests: CollectedTest[]) =>
  tests.map((test) => JSON.stringify([path.relative(root, test.file), test.name])).toSorted();

const baseline = reports('baseline', baselineNames);
const candidate = reports('candidate', candidateNames);
const baselineCollection = collected('baseline', baselineNames);
assert.deepEqual(
  candidate.map((file) => file.name).toSorted(),
  baseline.map((file) => file.name).toSorted(),
);
assert.deepEqual(identities(candidate), identities(baseline));
assert.deepEqual(
  listIdentities(collected('candidate', candidateNames)),
  listIdentities(baselineCollection),
);
assert.equal(new Set(baseline.map((file) => file.name)).size, 87);
assert.equal(new Set(candidate.map((file) => file.name)).size, 87);
const perProject = projects.map((project) => {
  const files = baseline.filter((file) => path.relative(root, file.name).startsWith(`${project}/`));
  return {
    files: files.length,
    project,
    tests: files.flatMap((file) => file.assertionResults).length,
  };
});
const summary = {
  collectedTests: baselineCollection.length,
  collectionEquivalent: true,
  files: baseline.length,
  perProject,
  resultsEquivalent: true,
  skipped: baseline
    .flatMap((file) => file.assertionResults)
    .filter((test) => test.status === 'skipped'),
  tests: identities(baseline).length,
};
writeFileSync(path.join(out, 'equivalence.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
