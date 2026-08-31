import { defineCommand } from 'citty';
import { Effect } from 'effect';

import { detectAll, detectSingle } from '@/lib/detect.js';
import { checkExitCode, freshnessOf } from '@/lib/freshness.js';
import { renderStatusTable } from '@/lib/output.js';
import { getPlatform } from '@/lib/platforms.js';
import { VALID_PLATFORMS } from '@/lib/validation.js';

async function handleCheckAll(args: { json?: boolean; quiet?: boolean }): Promise<never> {
  const allStatus = await Effect.runPromise(detectAll());
  const checked = allStatus.filter((s) => s.available);
  if (checked.length === 0) {
    if (args.quiet !== true) {
      console.log('No supported coding agent platforms detected on this machine.');
    }
    process.exit(1);
  }
  const freshnessList = checked.map((s) =>
    s.installed ? freshnessOf(s.installedVersion, s.latestVersion) : 'unknown',
  );
  if (args.json === true) {
    console.log(
      JSON.stringify(
        checked.map((s, i) => ({ ...s, outdated: freshnessList[i] === 'outdated' })),
        null,
        2,
      ),
    );
  } else {
    console.log(renderStatusTable(checked));
  }
  process.exit(
    checked.every((s) => s.installed) ? (freshnessList.includes('outdated') ? 3 : 0) : 1,
  );
}

// oxlint-disable-next-line max-lines-per-function -- handleCheckSingle is a cohesive status-reporting flow with sequential early exits for missing CLI, missing install, and version freshness; splitting would create single-use helpers that obscure the linear check sequence.
async function handleCheckSingle(
  platformId: string,
  args: { json?: boolean; quiet?: boolean },
): Promise<never> {
  const platform = getPlatform(platformId);
  if (!platform) {
    if (args.quiet !== true) {
      console.error(`Unknown platform: ${platformId}`);
      console.error(`Available: ${VALID_PLATFORMS.join(', ')}`);
    }
    process.exit(1);
  }
  const status = await Effect.runPromise(detectSingle(platformId));
  if (!status.available) {
    const result = {
      available: false,
      message: `CLI tool for ${platform.label} is not available on this machine`,
      platform: platformId,
      pluginInstalled: false,
    };
    if (args.json === true) {
      console.log(JSON.stringify(result));
    } else {
      console.log(`${platform.label}: CLI tool is not available on this machine`);
    }
    process.exit(1);
  }
  if (!status.installed) {
    const result = {
      available: true,
      installedVersion: status.installedVersion,
      message: `@maestria/${platformId} is not installed for ${platform.label}`,
      platform: platformId,
      pluginInstalled: false,
    };
    if (args.json === true) {
      console.log(JSON.stringify(result));
    } else {
      console.log(`@maestria/${platformId} is not installed for ${platform.label}`);
    }
    process.exit(1);
  }
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
    console.log(JSON.stringify(result));
  } else {
    const version =
      status.installedVersion !== undefined &&
      status.installedVersion !== null &&
      status.installedVersion !== ''
        ? ` (v${status.installedVersion})`
        : '';
    console.log(`@maestria/${platformId} is installed for ${platform.label}${version}`);
    if (freshness === 'outdated') {
      console.log(
        `update available: v${status.installedVersion} -> v${status.latestVersion} (run 'maestria update ${platformId}')`,
      );
    }
  }
  process.exit(checkExitCode(freshness, status.installed));
}

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
  run: async ({ args }) => {
    const platformId = args.platform;
    if (args.all && platformId !== undefined && platformId !== null && platformId !== '') {
      if (!args.quiet) {
        console.error('Cannot use --all with a specific platform. Choose one.');
      }
      process.exit(1);
    }
    if (args.all) {
      await handleCheckAll(args);
    } else if (platformId !== undefined && platformId !== null && platformId !== '') {
      await handleCheckSingle(platformId, args);
    } else {
      if (!args.quiet) {
        console.error('Missing required platform argument.');
        console.error('Usage: maestria check <platform> or maestria check --all');
        console.error(`Available: ${VALID_PLATFORMS.join(', ')}`);
      }
      process.exit(1);
    }
  },
});
