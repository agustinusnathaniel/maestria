// Asks before PR, issue, API, or commit text that contains an email address.
import {
  respondToTool,
  runJob,
  sessionDirectory,
  shellCommand,
  shellContext,
} from './lib/hosts.mjs';
import { classifyEmailScan } from './lib/policy.mjs';

await runJob((host, input) => {
  respondToTool(
    host,
    classifyEmailScan(shellCommand(input), shellContext(sessionDirectory(input))),
  );
});
