// Asks before a shell command prints the whole environment, secrets included.
import { respondToTool, runJob, shellCommand } from './lib/hosts.mjs';
import { classifyEnvDump } from './lib/policy.mjs';

await runJob((host, input) => {
  respondToTool(host, classifyEnvDump(shellCommand(input)));
});
