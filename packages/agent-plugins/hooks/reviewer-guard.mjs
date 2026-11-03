// Blocks edit-tool calls inside the maestria reviewer subagent on hosts whose hook input names
// the subagent. Codex no longer applies a role's sandbox_mode, so this backs up the reviewer's
// read-only instructions there; writes made through the shell are not covered.
import { respondToTool, runJob } from './lib/hosts.mjs';

const REVIEWER = 'maestria-reviewer';
const EDIT_TOOLS = new Set(['apply_patch', 'Edit', 'Write']);

await runJob((host, input) => {
  const blocked = input.agent_type === REVIEWER && EDIT_TOOLS.has(String(input.tool_name));
  respondToTool(
    host,
    blocked
      ? {
          reason: 'the reviewer is read-only and must not edit files; report the fix instead',
          verdict: 'block',
        }
      : { reason: '', verdict: 'allow' },
  );
});
