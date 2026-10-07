import { writeFileSync } from 'node:fs';
import path from 'node:path';

import { executeGraph } from './graph.ts';
import { stages } from './stages.ts';

const [flag, failedStage] = process.argv.slice(2);
if (
  flag &&
  (flag !== '--probe' ||
    !failedStage ||
    !['build', 'workspace-tests', 'docs'].includes(failedStage))
) {
  throw new Error('Expected --probe build|workspace-tests|docs');
}
const out = path.resolve(
  import.meta.dirname,
  '../../artifacts/ci-proof',
  failedStage ? `probes/${failedStage}` : 'candidate-dag',
);
const selected = failedStage
  ? stages.map((stage) => ({
      ...stage,
      command: [
        process.execPath,
        '-e',
        `setTimeout(() => process.exit(${stage.name === failedStage ? 23 : 0}), 40)`,
      ],
    }))
  : stages;
const results = await executeGraph(selected, out);
writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
process.exitCode = results.every((result) => result.state === 'passed') ? 0 : 1;
