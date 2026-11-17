import { lstat } from 'node:fs/promises';
import path from 'node:path';
import { defineCommand } from 'citty';
import { Effect } from 'effect';

import { toCommandRun } from '@/lib/command-runner.js';
import { CliError } from '@/lib/command-result.js';
import type { CommandResult } from '@/lib/command-result.js';
import { MAESTRIA_PLUGIN_PACKAGE } from '@/lib/package-constants.js';
import { installNpmTarball, readPackageJsonVersion } from '@/lib/platforms.js';
import { isFileNotFound } from '@/lib/primitives.js';
import { getMaestriaCacheDir } from '@/lib/shell.js';

export interface PluginInstallArgs {
  destination?: string;
  json?: boolean;
}

export const handlePluginInstall = async (args: PluginInstallArgs): Promise<CommandResult> => {
  try {
    const fallback = path.join(getMaestriaCacheDir(), 'agent-plugins', 'maestria');
    const requested = args.destination?.trim() ?? '';
    const destination = path.resolve(requested === '' ? fallback : requested);
    if (requested !== '') {
      let exists = false;
      try {
        await lstat(destination);
        exists = true;
      } catch (error) {
        if (!isFileNotFound(error)) {
          throw new CliError(error instanceof Error ? error.message : String(error), 1);
        }
      }
      if (exists) {
        throw new CliError(
          `Destination already exists: ${destination}. Choose another destination or remove it first.`,
          1,
        );
      }
    }
    await Effect.runPromise(installNpmTarball(MAESTRIA_PLUGIN_PACKAGE, destination));
    const version = await Effect.runPromise(
      readPackageJsonVersion(path.join(destination, 'package.json')).pipe(
        Effect.catchEager(() => Effect.succeed('unknown')),
      ),
    );
    if (args.json === true) {
      return {
        exitCode: 0,
        output: JSON.stringify({ destination, package: MAESTRIA_PLUGIN_PACKAGE, version }, null, 2),
      };
    }
    return {
      exitCode: 0,
      output: [
        `Staged ${MAESTRIA_PLUGIN_PACKAGE}@${version} at ${destination}`,
        'Point a compatible client at this directory to load the package.',
      ].join('\n'),
    };
  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }
    throw new CliError(error instanceof Error ? error.message : String(error), 1);
  }
};

const installCommand = defineCommand({
  args: {
    destination: {
      description: 'Directory where the package should be staged',
      type: 'string',
    },
    json: {
      default: false,
      description: 'Output the staged package report as JSON',
      type: 'boolean',
    },
  },
  meta: {
    description: 'Stage @maestria/agent-plugins from npm into the maestria cache',
    name: 'install',
  },
  run: toCommandRun(handlePluginInstall),
});

export const pluginCommand = defineCommand({
  meta: {
    description: 'Stage the maestria portable package for compatible clients',
    name: 'plugin',
  },
  subCommands: {
    install: installCommand,
  },
});
