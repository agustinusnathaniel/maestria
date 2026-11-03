// Blocks git hook bypasses and asks before commits or pushes to protected branches, force pushes,
// and commands that discard work.
import {
  respondToTool,
  runJob,
  sessionDirectory,
  shellCommand,
  shellContext,
} from './lib/hosts.mjs';
import { classifyGitSafety } from './lib/policy.mjs';

await runJob((host, input) => {
  respondToTool(
    host,
    classifyGitSafety(shellCommand(input), shellContext(sessionDirectory(input))),
  );
});
