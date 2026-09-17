import { defineCommand } from 'citty';

import { toCommandRun } from '@/lib/command-runner.js';
import { CliError } from '@/lib/command-result.js';
import type { CommandResult } from '@/lib/command-result.js';
import { stageAgentPlugin } from '@/lib/agent-plugin-staging.js';
import { formatAgentPluginValidation, validateAgentPlugin } from '@/lib/agent-plugin-validation.js';

export interface PluginValidateArgs {
  json?: boolean;
  path: string;
}

export interface PluginInstallArgs {
  destination?: string;
  json?: boolean;
  source?: string;
}

export const handlePluginValidate = async (args: PluginValidateArgs): Promise<CommandResult> => {
  const report = await validateAgentPlugin(args.path);
  return {
    exitCode: report.valid ? 0 : 1,
    output:
      args.json === true ? JSON.stringify(report, null, 2) : formatAgentPluginValidation(report),
  };
};

export const handlePluginInstall = async (args: PluginInstallArgs): Promise<CommandResult> => {
  try {
    const staged = await stageAgentPlugin({
      destination: args.destination,
      source: args.source,
    });
    if (args.json === true) {
      return { exitCode: 0, output: JSON.stringify(staged, null, 2) };
    }
    const versionSuffix =
      staged.version === undefined || staged.version === '' ? '' : `@${staged.version}`;
    return {
      exitCode: 0,
      output: [
        `Staged ${staged.name ?? 'Agent Plugin'}${versionSuffix} at ${staged.destination}`,
        'Point a compatible client at this directory to load the portable package.',
      ].join('\n'),
    };
  } catch (error) {
    throw new CliError(error instanceof Error ? error.message : String(error), 1);
  }
};

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
  run: toCommandRun(handlePluginValidate),
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
  run: toCommandRun(handlePluginInstall),
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
