import { defineCommand } from 'citty';
import { Effect } from 'effect';
import { getPlatform } from '@/lib/platforms.js';
import { detectAll } from '@/lib/detect.js';
import type { PlatformStatus } from '@/types.js';

export const checkCommand = defineCommand({
  meta: {
    name: 'check',
    description: 'Check installation status of a maestria plugin on a specific platform',
  },
  args: {
    platform: {
      type: 'positional',
      description: 'Platform to check (opencode, pi, hermes, kimi-code, cursor)',
      required: true,
    },
    json: {
      type: 'boolean',
      description:
        'Output as JSON — structured machine-readable format optimized for AI agents and CI pipelines',
      default: true,
    },
    quiet: {
      type: 'boolean',
      description: 'Suppress non-essential output. Exit code is the signal.',
      default: false,
    },
  },
  run: async ({ args }) => {
    const platformId = args.platform as string;

    // Validate platform exists
    const platform = getPlatform(platformId);
    if (!platform) {
      if (!args.quiet) {
        console.error(`Unknown platform: ${platformId}`);
        console.error('Available: opencode, pi, hermes, kimi-code, cursor');
      }
      process.exit(1);
    }

    // Detect all (parallel, fast — uses cached effects)
    const allStatus = await Effect.runPromise(detectAll());
    const status = allStatus.find((s) => s.id === platformId) as PlatformStatus;

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
      }
      process.exit(1);
    }

    // Everything is good
    const result = {
      platform: platformId,
      available: true,
      pluginInstalled: true,
      installedVersion: status.installedVersion,
      latestVersion: status.latestVersion || undefined,
    };
    if (args.json) {
      console.log(JSON.stringify(result));
    }
    process.exit(0);
  },
});
