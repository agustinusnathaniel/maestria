import { defineCommand } from 'citty';
import { Effect } from 'effect';
import { detectAll } from '@/lib/detect.js';
import {
  createSpinner,
  renderStatusTable,
  renderCompactStatus,
  formatStatusJson,
} from '@/lib/output.js';
import type { StatusOutput } from '@/types.js';

export const statusCommand = defineCommand({
  meta: {
    name: 'status',
    description: 'Show installed maestria plugins and version info',
  },
  args: {
    json: {
      type: 'boolean',
      description:
        'Output status as JSON - structured machine-readable format optimized for AI agents and CI pipelines',
      default: false,
    },
    quiet: {
      type: 'boolean',
      description: 'Suppress spinner. Recommended for CI and non-interactive usage.',
      default: false,
    },
    compact: {
      type: 'boolean',
      description: 'Minimal machine-friendly text output. One line per platform.',
      default: false,
    },
  },
  run: async ({ args }) => {
    const isQuiet = (args.quiet || args.compact) as boolean;
    const isCompact = args.compact as boolean;

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
