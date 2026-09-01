import { defineCommand } from 'citty';

import {
  formatAgentPluginValidation,
  stageAgentPlugin,
  validateAgentPlugin,
} from '@/lib/agent-plugin.js';

const validateCommand = defineCommand({
  args: {
    json: {
      default: false,
      description: 'Output the validation report as JSON',
      type: 'boolean',
    },
    path: {
      description: 'Path to an Agent Plugin directory containing plugin.json',
      required: true,
      type: 'positional',
    },
  },
  meta: {
    description: 'Validate an Agent Plugins v1 directory package',
    name: 'validate',
  },
  run: async ({ args }) => {
    const report = await validateAgentPlugin(args.path);
    console.log(args.json ? JSON.stringify(report, null, 2) : formatAgentPluginValidation(report));
    process.exit(report.valid ? 0 : 1);
  },
});

const installCommand = defineCommand({
  args: {
    destination: {
      description: 'Directory where the validated package should be staged',
      type: 'string',
    },
    json: {
      default: false,
      description: 'Output the staged package report as JSON',
      type: 'boolean',
    },
    source: {
      default: '@maestria/agent-plugin',
      description: 'Local Agent Plugin directory or npm package specifier',
      type: 'positional',
    },
  },
  meta: {
    description: 'Fetch, validate, and stage a portable Agent Plugin',
    name: 'install',
  },
  run: async ({ args }) => {
    try {
      const staged = await stageAgentPlugin({
        destination: args.destination,
        source: args.source,
      });
      if (args.json) {
        console.log(JSON.stringify(staged, null, 2));
      } else {
        const versionSuffix =
          staged.version === undefined || staged.version === '' ? '' : `@${staged.version}`;
        console.log(
          `Staged ${staged.name ?? 'Agent Plugin'}${versionSuffix} at ${staged.destination}`,
        );
        console.log('Point a compatible client at this directory to load the portable package.');
      }
      process.exit(0);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  },
});

export const pluginCommand = defineCommand({
  meta: {
    description: 'Validate and stage portable Agent Plugins',
    name: 'plugin',
  },
  subCommands: {
    install: installCommand,
    validate: validateCommand,
  },
});
