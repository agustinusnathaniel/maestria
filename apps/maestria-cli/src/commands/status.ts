import { defineCommand } from 'citty';
import { Effect } from 'effect';

import { toCommandRun } from '@/lib/command-runner.js';
import type { CommandResult } from '@/lib/command-result.js';
import { detectAll } from '@/lib/detect.js';
import {
  createSpinner,
  formatStatusJson,
  renderCompactStatus,
  renderStatusTable,
} from '@/lib/output.js';
import type { StatusOutput } from '@/types.js';

export interface StatusArgs {
  compact?: boolean;
  json?: boolean;
  quiet?: boolean;
}

export const handleStatus = async (args: StatusArgs): Promise<CommandResult> => {
  const isQuiet = args.quiet === true || args.compact === true;
  const isCompact = args.compact === true;

  const spinner = createSpinner(isQuiet);
  spinner.start('Detecting platforms...');

  const output = await Effect.runPromise(detectAll());

  let rendered: string;
  if (args.json === true) {
    spinner.stop('');
    const jsonOutput: StatusOutput = { platforms: output };
    rendered = formatStatusJson(jsonOutput);
  } else if (isCompact) {
    spinner.stop('');
    rendered = renderCompactStatus(output);
  } else {
    spinner.stop('Done');
    rendered = renderStatusTable(output);
  }

  return { exitCode: 0, output: rendered };
};

export const statusCommand = defineCommand({
  args: {
    compact: {
      default: false,
      description: 'Minimal machine-friendly text output. One line per platform.',
      type: 'boolean',
    },
    json: {
      default: false,
      description:
        'Output status as JSON - structured machine-readable format optimized for AI agents and CI pipelines',
      type: 'boolean',
    },
    quiet: {
      default: false,
      description: 'Suppress spinner. Recommended for CI and non-interactive usage.',
      type: 'boolean',
    },
  },
  meta: {
    description: 'Show installed maestria plugins and version info',
    name: 'status',
  },
  run: toCommandRun(handleStatus),
});
