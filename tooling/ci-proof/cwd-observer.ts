import { appendFileSync } from 'node:fs';

const filename = process.env.CI_PROOF_CWD_LOG;
if (filename !== undefined && filename !== '') {
  appendFileSync(
    filename,
    `${JSON.stringify({ argv: process.argv, cwd: process.cwd(), pid: process.pid })}\n`,
  );
}
