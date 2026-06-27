#!/usr/bin/env node
import { defineCommand, runMain } from 'citty';
import { Effect } from 'effect';
import { installCommand } from './commands/install.js';
import { updateCommand } from './commands/update.js';
import { statusCommand } from './commands/status.js';
import { detectAll } from './lib/detect.js';
import { renderStatusTable } from './lib/output.js';

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
    const output = await Effect.runPromise(detectAll());
    console.log(renderStatusTable(output));
  },
});

void runMain(main);
