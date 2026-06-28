#!/usr/bin/env node
import { defineCommand, runMain } from 'citty';
import { Effect } from 'effect';
import { installCommand } from '@/commands/install.js';
import { updateCommand } from '@/commands/update.js';
import { statusCommand } from '@/commands/status.js';
import { detectAll } from '@/lib/detect.js';
import { createSpinner, renderStatusTable } from '@/lib/output.js';

// Ensure clean exit on signals — prevents Effect runtime from keeping process alive
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

const main = defineCommand({
  meta: {
    name: 'maestria',
    description: 'Manage maestria plugins across coding agent platforms',
  },
  subCommands: {
    install: installCommand,
    update: updateCommand,
    status: statusCommand,
  },
  run: async () => {
    const spinner = createSpinner(false);
    spinner.start('Detecting platforms...');

    const output = await Effect.runPromise(detectAll());

    spinner.stop('Done');
    console.log(renderStatusTable(output));
    process.exit(0);
  },
});

runMain(main).catch((error) => {
  console.error(error);
  process.exit(1);
});
