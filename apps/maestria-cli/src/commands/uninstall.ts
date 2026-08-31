import { cancel, isCancel, select } from '@clack/prompts';
import { defineCommand } from 'citty';
import { Effect } from 'effect';

import { detectInstalled } from '@/lib/detect.js';
import { createSpinner, renderCompactResults, renderResults } from '@/lib/output.js';
import { getPlatform, platforms } from '@/lib/platforms.js';
import type { PlatformHandler } from '@/lib/platforms.js';
import { exitCodeForResults } from '@/lib/result-exit.js';
import { VALID_PLATFORMS } from '@/lib/validation.js';
import type { PlatformResult } from '@/types.js';

const uninstallOne = (platform: PlatformHandler, quiet: boolean): Effect.Effect<PlatformResult> =>
  Effect.gen(function* uninstallOneEffect() {
    const spinner = createSpinner(quiet);
    spinner.start(`Uninstalling ${platform.label}...`);

    const errorMessage: string | null = yield* platform.uninstall.pipe(
      Effect.as(null),
      Effect.catchTag('CommandError', (error) => Effect.succeed(error.message)),
    );

    if (errorMessage === null) {
      spinner.stop('Uninstalled');
      return {
        id: platform.id,
        label: platform.label,
        message: 'Uninstalled',
        ok: true,
      } satisfies PlatformResult;
    }

    spinner.stop(`Failed: ${errorMessage}`);
    return {
      id: platform.id,
      label: platform.label,
      message: errorMessage,
      ok: false,
    } satisfies PlatformResult;
  });

const runUninstallAll = async (isQuiet: boolean): Promise<PlatformResult[]> => {
  const spinner = createSpinner(isQuiet);
  spinner.start('Detecting platforms...');
  const installed = await Effect.runPromise(detectInstalled());
  spinner.stop('Done');
  if (installed.length === 0) {
    console.log('No maestria installations found to uninstall.');
    process.exit(0);
  }
  return await Effect.runPromise(
    Effect.all(
      installed.map((p) => {
        const platform = getPlatform(p.id);
        if (!platform) {
          return Effect.succeed({
            id: p.id,
            label: p.label,
            message: 'Platform definition not found. This is a bug.',
            ok: false,
          } satisfies PlatformResult);
        }
        return uninstallOne(platform, isQuiet);
      }),
      { concurrency: 1 },
    ),
  );
};

const runUninstallInteractive = async (isQuiet: boolean): Promise<PlatformResult[]> => {
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
    options: installed.map((p) => ({ label: p.label, value: p.id })),
  });
  if (isCancel(selected) || !selected) {
    cancel('Uninstall cancelled.');
    process.exit(130);
  }
  const platform = getPlatform(selected);
  if (!platform) {
    return [
      {
        id: selected,
        label: selected,
        message: 'Platform definition not found. This is a bug.',
        ok: false,
      } satisfies PlatformResult,
    ];
  }
  return [await Effect.runPromise(uninstallOne(platform, isQuiet))];
};

export const uninstallCommand = defineCommand({
  args: {
    all: {
      alias: 'a',
      default: false,
      description: 'Uninstall all installed platforms',
      type: 'boolean',
    },
    compact: {
      default: false,
      description: 'Minimal machine-friendly text output. Strips colors and decorative formatting.',
      type: 'boolean',
    },
    json: {
      default: false,
      description:
        'Output results as JSON - structured machine-readable format optimized for AI agents and CI pipelines',
      type: 'boolean',
    },
    platform: {
      description: `Platform to uninstall. One of: ${VALID_PLATFORMS.join(', ')}. Pass directly to skip interactive selection.`,
      required: false,
      type: 'positional',
    },
    quiet: {
      default: false,
      description:
        'Suppress spinner and non-essential output. Recommended for CI and non-interactive usage.',
      type: 'boolean',
    },
  },
  meta: {
    description: 'Uninstall maestria plugins for coding agent platforms',
    name: 'uninstall',
  },
  run: async ({ args }) => {
    const isQuiet = args.quiet || args.compact;
    const isCompact = args.compact;
    const results: PlatformResult[] = [];
    if (args.platform !== undefined && args.platform !== null && args.platform !== '') {
      const platform = getPlatform(args.platform);
      if (!platform) {
        console.error(`Unknown platform: ${args.platform}`);
        console.error(`Available: ${platforms.map((p) => p.id).join(', ')}`);
        process.exit(1);
      }
      results.push(await Effect.runPromise(uninstallOne(platform, isQuiet)));
    } else if (args.all) {
      results.push(...(await runUninstallAll(isQuiet)));
    } else {
      results.push(...(await runUninstallInteractive(isQuiet)));
    }
    if (args.json) {
      console.log(JSON.stringify(results, null, 2));
    } else if (isCompact) {
      console.log(renderCompactResults(results));
    } else {
      console.log(renderResults(results));
    }
    process.exit(exitCodeForResults(results));
  },
});
