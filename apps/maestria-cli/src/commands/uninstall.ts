import { defineCommand } from 'citty';
import { Effect } from 'effect';
import { select, isCancel, cancel } from '@clack/prompts';
import { platforms, getPlatform } from '@/lib/platforms.js';
import { detectInstalled } from '@/lib/detect.js';
import { createSpinner, renderResults, renderCompactResults } from '@/lib/output.js';

import type { PlatformResult } from '@/types.js';

export const uninstallCommand = defineCommand({
  meta: {
    name: 'uninstall',
    description: 'Uninstall maestria plugins for coding agent platforms',
  },
  args: {
    platform: {
      type: 'positional',
      description:
        'Platform to uninstall. One of: opencode, pi, kimi-code, hermes, cursor. Pass directly to skip interactive selection.',
      required: false,
    },
    all: {
      type: 'boolean',
      description: 'Uninstall all installed platforms',
      alias: 'a',
      default: false,
    },
    json: {
      type: 'boolean',
      description:
        'Output results as JSON - structured machine-readable format optimized for AI agents and CI pipelines',
      default: false,
    },
    quiet: {
      type: 'boolean',
      description:
        'Suppress spinner and non-essential output. Recommended for CI and non-interactive usage.',
      default: false,
    },
    compact: {
      type: 'boolean',
      description: 'Minimal machine-friendly text output. Strips colors and decorative formatting.',
      default: false,
    },
  },
  run: async ({ args }) => {
    const isQuiet = (args.quiet || args.compact) as boolean;
    const isCompact = args.compact as boolean;

    const results: PlatformResult[] = [];

    if (args.platform) {
      const platform = getPlatform(args.platform as string);
      if (!platform) {
        console.error(`Unknown platform: ${args.platform}`);
        console.error(`Available: ${platforms.map((p) => p.id).join(', ')}`);
        process.exit(1);
      }

      const result = await Effect.runPromise(uninstallOne(platform, isQuiet));
      results.push(result);
    } else if (args.all) {
      const spinner = createSpinner(isQuiet);
      spinner.start('Detecting platforms...');
      const installed = await Effect.runPromise(detectInstalled());
      spinner.stop('Done');

      if (installed.length === 0) {
        console.log('No maestria installations found to uninstall.');
        process.exit(0);
      }

      for (const p of installed) {
        const platform = getPlatform(p.id);
        if (!platform) {
          results.push({
            id: p.id,
            label: p.label,
            ok: false,
            message: 'Platform definition not found. This is a bug.',
          } satisfies PlatformResult);
          continue;
        }
        const result = await Effect.runPromise(uninstallOne(platform, isQuiet));
        results.push(result);
      }
    } else {
      if (!process.stdout.isTTY || !process.stdin.isTTY) {
        console.error('No platform specified and not in an interactive terminal.');
        console.error('Usage: maestria uninstall <platform> or maestria uninstall --all');
        console.error("Run 'maestria uninstall --help' for details.");
        process.exit(1);
      }

      const spinner = createSpinner(isQuiet);
      spinner.start('Detecting platforms...');
      const installed = await Effect.runPromise(detectInstalled());
      spinner.stop('Done');

      if (installed.length === 0) {
        console.log('No maestria installations found to uninstall.');
        process.exit(0);
      }

      const selected = await select({
        message: 'Which platform do you want to uninstall maestria for?',
        options: installed.map((p) => ({
          value: p.id,
          label: p.label,
        })),
      });

      if (isCancel(selected) || !selected) {
        cancel('Uninstall cancelled.');
        process.exit(130);
      }

      const platform = getPlatform(String(selected));
      if (!platform) {
        results.push({
          id: String(selected),
          label: String(selected),
          ok: false,
          message: 'Platform definition not found. This is a bug.',
        } satisfies PlatformResult);
      } else {
        const result = await Effect.runPromise(uninstallOne(platform, isQuiet));
        results.push(result);
      }
    }

    if (args.json) {
      console.log(JSON.stringify(results, null, 2));
    } else if (isCompact) {
      console.log(renderCompactResults(results));
    } else {
      console.log(renderResults(results));
    }
    process.exit(0);
  },
});

function uninstallOne(
  platform: import('@/lib/platforms.js').PlatformHandler,
  quiet: boolean,
): Effect.Effect<PlatformResult, never> {
  return Effect.gen(function* () {
    const spinner = createSpinner(quiet);
    spinner.start(`Uninstalling ${platform.label}...`);

    const errorMessage: string | void = yield* platform.uninstall.pipe(
      Effect.catchTag('CommandError', (error) => Effect.succeed(error.message)),
    );

    if (errorMessage === undefined) {
      spinner.stop('Uninstalled');
      return {
        id: platform.id,
        label: platform.label,
        ok: true,
        message: 'Uninstalled',
      } satisfies PlatformResult;
    }

    spinner.stop(`Failed: ${errorMessage}`);
    return {
      id: platform.id,
      label: platform.label,
      ok: false,
      message: errorMessage,
    } satisfies PlatformResult;
  });
}
