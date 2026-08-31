import { defineCommand } from 'citty';
import { Effect } from 'effect';

import { detectAll } from '@/lib/detect.js';
import {
  createSpinner,
  formatStatusJson,
  renderCompactStatus,
  renderStatusTable,
} from '@/lib/output.js';
import type { StatusOutput } from '@/types.js';

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
  run: async ({ args }) => {
    const isQuiet = args.quiet || args.compact;
    const isCompact = args.compact;

    const spinner = createSpinner(isQuiet);
    spinner.start('Detecting platforms...');

    const output = await Effect.runPromise(detectAll());

    if (args.json) {
      spinner.stop('');
      const jsonOutput: StatusOutput = { platforms: output };
      console.log(formatStatusJson(jsonOutput));
    } else if (isCompact) {
      spinner.stop('');
      console.log(renderCompactStatus(output));
    } else {
      spinner.stop('Done');
      console.log(renderStatusTable(output));
    }

    process.exit(0);
  },
});
