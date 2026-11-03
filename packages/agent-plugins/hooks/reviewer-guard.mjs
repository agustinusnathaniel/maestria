// Blocks file edits inside the maestria reviewer subagent on hosts whose hook input names the
// subagent. Codex no longer applies a role's sandbox_mode, so this backs up the reviewer's
// read-only instructions there.
import { respondToTool, runJob } from './lib/hosts.mjs';

const REVIEWER = 'maestria-reviewer';

await runJob((host, input) => {
  respondToTool(
    host,
    input.agent_type === REVIEWER
      ? {
          reason: 'the reviewer is read-only and must not edit files; report the fix instead',
          verdict: 'block',
        }
      : { reason: '', verdict: 'allow' },
  );
});
