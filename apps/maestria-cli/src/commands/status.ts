import { defineCommand } from 'citty';
import { Effect } from 'effect';
import { detectAll } from '../lib/detect.js';
import { renderStatusTable, formatStatusJson } from '../lib/output.js';
import type { StatusOutput } from '../types.js';

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
    const output = await Effect.runPromise(detectAll());

    if (args.json) {
      const jsonOutput: StatusOutput = { platforms: output };
      console.log(formatStatusJson(jsonOutput));
    } else {
      console.log(renderStatusTable(output));
    }
  },
});
