import { defineCommand } from 'citty';
import { Effect } from 'effect';
import { detectAll, detectSingle } from '@/lib/detect.js';
import { freshnessOf, checkExitCode } from '@/lib/freshness.js';
import { getPlatform } from '@/lib/platforms.js';
import { renderStatusTable } from '@/lib/output.js';
import { VALID_PLATFORMS } from '@/lib/validation.js';

export const checkCommand = defineCommand({
  meta: {
    name: 'check',
    description:
      'Check installation status of a maestria plugin on a specific platform and detect outdated installs',
  },
  args: {
    platform: {
      type: 'positional',
      description: `Platform to check (${VALID_PLATFORMS.join(', ')}).`,
      required: false,
    },
    all: {
      type: 'boolean',
      description: 'Check all detected platforms at once',
      alias: 'a',
      default: false,
    },
    json: {
      type: 'boolean',
      description:
        'Output as JSON — structured machine-readable format optimized for AI agents and CI pipelines',
      default: false,
    },
    quiet: {
      type: 'boolean',
      description: 'Suppress non-essential output. Exit code is the signal.',
      default: false,
    },
  },
  run: async ({ args }) => {
    const platformId = args.platform as string | undefined;

    if (args.all && platformId) {
      if (!args.quiet) {
        console.error('Cannot use --all with a specific platform. Choose one.');
      }
      process.exit(1);
    }

    // --all mode: check every detected, available platform
    if (args.all) {
      const allStatus = await Effect.runPromise(detectAll());
      const checked = allStatus.filter((s) => s.available);

      if (checked.length === 0) {
        if (!args.quiet) {
          console.log('No supported coding agent platforms detected on this machine.');
        }
        process.exit(1);
      }

      const freshnessList = checked.map((s) =>
        s.installed ? freshnessOf(s.installedVersion, s.latestVersion) : 'unknown',
      );

      if (args.json) {
        const results = checked.map((s, i) => ({
          ...s,
          outdated: freshnessList[i] === 'outdated',
        }));
        console.log(JSON.stringify(results, null, 2));
      } else {
        console.log(renderStatusTable(checked));
      }
      const allInstalled = checked.every((s) => s.installed);
      process.exit(allInstalled ? (freshnessList.includes('outdated') ? 3 : 0) : 1);
    }

    if (!platformId) {
      if (!args.quiet) {
        console.error('Missing required platform argument.');
        console.error('Usage: maestria check <platform> or maestria check --all');
        console.error(`Available: ${VALID_PLATFORMS.join(', ')}`);
      }
      process.exit(1);
    }

    // Validate platform exists
    const platform = getPlatform(platformId);
    if (!platform) {
      if (!args.quiet) {
        console.error(`Unknown platform: ${platformId}`);
        console.error(`Available: ${VALID_PLATFORMS.join(', ')}`);
      }
      process.exit(1);
    }

    // Detect single platform (only runs detection for this one platform)
    const status = await Effect.runPromise(detectSingle(platformId));

    // Check if the CLI tool is even available
    if (!status.available) {
      const result = {
        platform: platformId,
        available: false,
        pluginInstalled: false,
        message: `CLI tool for ${platform.label} is not available on this machine`,
      };
      if (args.json) {
        console.log(JSON.stringify(result));
      } else {
        console.log(`${platform.label}: CLI tool is not available on this machine`);
      }
      process.exit(1);
    }

    // Check if the maestria plugin is installed
    if (!status.installed) {
      const result = {
        platform: platformId,
        available: true,
        pluginInstalled: false,
        message: `@maestria/${platformId} is not installed for ${platform.label}`,
        installedVersion: status.installedVersion,
      };
      if (args.json) {
        console.log(JSON.stringify(result));
      } else {
        console.log(`@maestria/${platformId} is not installed for ${platform.label}`);
      }
      process.exit(1);
    }

    // Everything is good
    const freshness = freshnessOf(status.installedVersion, status.latestVersion);
    const result = {
      platform: platformId,
      available: true,
      pluginInstalled: true,
      installedVersion: status.installedVersion,
      latestVersion: status.latestVersion || undefined,
      outdated: freshness === 'outdated',
    };
    if (args.json) {
      console.log(JSON.stringify(result));
    } else {
      const version = status.installedVersion ? ` (v${status.installedVersion})` : '';
      console.log(`@maestria/${platformId} is installed for ${platform.label}${version}`);
      if (freshness === 'outdated') {
        console.log(
          `update available: v${status.installedVersion} -> v${status.latestVersion} (run 'maestria update ${platformId}')`,
        );
      }
    }
    process.exit(checkExitCode(freshness, status.installed));
  },
});
