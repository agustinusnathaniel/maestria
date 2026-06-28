import { defineCommand } from 'citty';
import { Effect } from 'effect';
import { detectAll } from '@/lib/detect.js';
import { createSpinner, renderStatusTable, formatStatusJson } from '@/lib/output.js';
import type { StatusOutput } from '@/types.js';

export const statusCommand = defineCommand({
  meta: {
    name: 'status',
    description: 'Show installed maestria plugins and version info',
  },
  args: {
    json: {
      type: 'boolean',
      description: 'Output as JSON',
      default: false,
    },
  },
  run: async ({ args }) => {
    const spinner = createSpinner(args.json as boolean);
    spinner.start('Detecting platforms...');

    const output = await Effect.runPromise(detectAll());

    if (args.json) {
      spinner.stop('');
      const jsonOutput: StatusOutput = { platforms: output };
      console.log(formatStatusJson(jsonOutput));
    } else {
      spinner.stop('Done');
      console.log(renderStatusTable(output));
    }

    process.exit(0);
  },
});
