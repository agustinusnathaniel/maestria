// Prints one part of maestria's always-on core, generated under context/, at session start and
// again after /clear and compaction. Each part stays under Claude Code's 10,000-character cap.
import { readFileSync } from 'node:fs';

import { respondWithContext, runJob } from './lib/hosts.mjs';

const PARTS = new Set(['core-loop', 'core-rules']);

await runJob((host, _input, [part]) => {
  if (!PARTS.has(part)) {
    throw new Error(`unknown core part ${part ?? ''}`);
  }
  respondWithContext(host, readFileSync(new URL(`context/${part}.md`, import.meta.url), 'utf-8'));
});
