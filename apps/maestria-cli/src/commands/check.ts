import { defineCommand } from 'citty';
import { Effect } from 'effect';

import { toCommandRun } from '@/lib/command-runner.js';
import { CliError } from '@/lib/command-result.js';
import type { CommandResult } from '@/lib/command-result.js';
import { detectAll, detectSingle } from '@/lib/detect.js';
import { checkExitCode, freshnessOf } from '@/lib/freshness.js';
import { renderStatusTable } from '@/lib/output.js';
import { getPlatform } from '@/lib/platforms.js';
import { VALID_PLATFORMS } from '@/lib/validation.js';
import type { PlatformStatus } from '@/types.js';

export interface CheckArgs {
  all?: boolean;
  json?: boolean;
  platform?: string;
  quiet?: boolean;
}

const handleCheckAll = async (args: CheckArgs): Promise<CommandResult> => {
  const allStatus = await Effect.runPromise(detectAll());
  const checked = allStatus.filter((s) => s.available);
  if (checked.length === 0) {
    return {
      exitCode: 1,
      output:
        args.quiet === true ? '' : 'No supported coding agent platforms detected on this machine.',
    };
  }
  const freshnessList = checked.map((s) =>
    s.installed ? freshnessOf(s.installedVersion, s.latestVersion) : 'unknown',
  );
  const output =
    args.json === true
      ? JSON.stringify(
          checked.map((s, i) => ({ ...s, outdated: freshnessList[i] === 'outdated' })),
          null,
          2,
        )
      : renderStatusTable(checked);
  const installed = checked.every((s) => s.installed);
  let exitCode = 1;
  if (installed) {
    exitCode = freshnessList.includes('outdated') ? 3 : 0;
  }
  return { exitCode, output };
};

const buildUnavailableResult = (
  platformId: string,
  label: string,
  args: CheckArgs,
): CommandResult => {
  const result = {
    available: false,
    message: `CLI tool for ${label} is not available on this machine`,
    platform: platformId,
    pluginInstalled: false,
  };
  return {
    exitCode: 1,
    output:
      args.json === true
        ? JSON.stringify(result)
        : `${label}: CLI tool is not available on this machine`,
  };
};

const buildNotInstalledResult = (
  platformId: string,
  label: string,
  installedVersion: string,
  args: CheckArgs,
): CommandResult => {
  const result = {
    available: true,
    installedVersion,
    message: `@maestria/${platformId} is not installed for ${label}`,
    platform: platformId,
    pluginInstalled: false,
  };
  return {
    exitCode: 1,
    output:
      args.json === true
        ? JSON.stringify(result)
        : `@maestria/${platformId} is not installed for ${label}`,
  };
};

const buildInstalledResult = (
  platformId: string,
  label: string,
  status: PlatformStatus,
  args: CheckArgs,
): CommandResult => {
  const freshness = freshnessOf(status.installedVersion, status.latestVersion);
  const result = {
    available: true,
    installedVersion: status.installedVersion,
    latestVersion: status.latestVersion || undefined,
    outdated: freshness === 'outdated',
    platform: platformId,
    pluginInstalled: true,
  };
  if (args.json === true) {
    return { exitCode: checkExitCode(freshness, status.installed), output: JSON.stringify(result) };
  }
  const version =
    status.installedVersion !== undefined &&
    status.installedVersion !== null &&
    status.installedVersion !== ''
      ? ` (v${status.installedVersion})`
      : '';
  const lines = [`@maestria/${platformId} is installed for ${label}${version}`];
  if (freshness === 'outdated') {
    lines.push(
      `update available: v${status.installedVersion} -> v${status.latestVersion} (run 'maestria update ${platformId}')`,
    );
  }
  return { exitCode: checkExitCode(freshness, status.installed), output: lines.join('\n') };
};

const handleCheckSingle = async (platformId: string, args: CheckArgs): Promise<CommandResult> => {
  const platform = getPlatform(platformId);
  if (!platform) {
    throw new CliError(
      args.quiet === true
        ? ''
        : `Unknown platform: ${platformId}\nAvailable: ${VALID_PLATFORMS.join(', ')}`,
      1,
    );
  }
  const status = await Effect.runPromise(detectSingle(platformId));
  if (!status.available) {
    return buildUnavailableResult(platformId, platform.label, args);
  }
  if (!status.installed) {
    return buildNotInstalledResult(platformId, platform.label, status.installedVersion, args);
  }
  return buildInstalledResult(platformId, platform.label, status, args);
};

export const handleCheck = async (args: CheckArgs): Promise<CommandResult> => {
  const platformId = args.platform;
  if (args.all === true && platformId !== undefined && platformId !== null && platformId !== '') {
    throw new CliError(
      args.quiet === true ? '' : 'Cannot use --all with a specific platform. Choose one.',
      1,
    );
  }
  if (args.all === true) {
    return await handleCheckAll(args);
  }
  if (platformId !== undefined && platformId !== null && platformId !== '') {
    return await handleCheckSingle(platformId, args);
  }
  throw new CliError(
    args.quiet === true
      ? ''
      : [
          'Missing required platform argument.',
          'Usage: maestria check <platform> or maestria check --all',
          `Available: ${VALID_PLATFORMS.join(', ')}`,
        ].join('\n'),
    1,
  );
};

export const checkCommand = defineCommand({
  args: {
    all: {
      alias: 'a',
      default: false,
      description: 'Check all detected platforms at once',
      type: 'boolean',
    },
    json: {
      default: false,
      description:
        'Output as JSON - structured machine-readable format optimized for AI agents and CI pipelines',
      type: 'boolean',
    },
    platform: {
      description: `Platform to check (${VALID_PLATFORMS.join(', ')}).`,
      required: false,
      type: 'positional',
    },
    quiet: {
      default: false,
      description: 'Suppress non-essential output. Exit code is the signal.',
      type: 'boolean',
    },
  },
  meta: {
    description:
      'Check installation status of a maestria plugin on a specific platform and detect outdated installs',
    name: 'check',
  },
  run: toCommandRun(handleCheck),
});
