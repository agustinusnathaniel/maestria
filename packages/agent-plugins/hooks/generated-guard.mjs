// Asks before an edit or write tool changes a file whose head marks it as generated.
import { readHeadIn, respondToTool, runJob, sessionDirectory } from './lib/hosts.mjs';
import { classifyGeneratedEdit, editTargets } from './lib/policy.mjs';

await runJob((host, input) => {
  const decision = classifyGeneratedEdit(
    editTargets(input.tool_input),
    readHeadIn(sessionDirectory(input)),
  );
  respondToTool(host, decision, { askable: host === 'claude' });
});
