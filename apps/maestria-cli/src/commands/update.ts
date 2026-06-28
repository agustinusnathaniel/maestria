import { defineCommand } from 'citty';
import { Effect } from 'effect';
import { select, isCancel, cancel } from '@clack/prompts';
import { platforms, getPlatform } from '../lib/platforms.js';
import type { PlatformHandler } from '../lib/platforms.js';
import { detectInstalled } from '../lib/detect.js';
import { createSpinner, renderResults } from '../lib/output.js';
import type { PlatformResult } from '../types.js';

export const updateCommand = defineCommand({
  meta: {
    name: 'update',
    description: 'Update maestria plugins to the latest version',
  },
  args: {
    platform: {
      type: 'positional',
      description: 'Platform to update. Omit for interactive selection.',
      required: false,
    },
    all: {
      type: 'boolean',
      description: 'Update all installed platforms',
      alias: 'a',
      default: false,
    },
    json: {
      type: 'boolean',
      description: 'Output as JSON',
      default: false,
    },
    quiet: {
      type: 'boolean',
      description: 'Suppress spinners',
      default: false,
    },
  },
  run: async ({ args }) => {
    const results: PlatformResult[] = [];

    if (args.platform) {
      const platform = getPlatform(args.platform as string);
      if (!platform) {
        console.error(`Unknown platform: ${args.platform}`);
        console.error(`Available: ${platforms.map((p) => p.id).join(', ')}`);
        return;
      }

      const result = await Effect.runPromise(updateOne(platform, args.quiet as boolean));
      results.push(result);
    } else if (args.all) {
      const spinner = createSpinner(args.quiet as boolean);
      spinner.start('Detecting platforms...');
      const installed = await Effect.runPromise(detectInstalled());
      spinner.stop('Done');

      if (installed.length === 0) {
        console.log('No maestria installations found to update.');
        return;
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
        const result = await Effect.runPromise(updateOne(platform, args.quiet as boolean));
        results.push(result);
      }
    } else {
      const spinner = createSpinner(args.quiet as boolean);
      spinner.start('Detecting platforms...');
      const installed = await Effect.runPromise(detectInstalled());
      spinner.stop('Done');

      if (installed.length === 0) {
        console.log('No maestria installations found to update.');
        return;
      }

      const selected = await select({
        message: 'Which platform do you want to update?',
        options: installed.map((p) => ({
          value: p.id,
          label: p.label,
          hint: p.latestVersion ? `latest: ${p.latestVersion}` : undefined,
        })),
      });

      if (isCancel(selected) || !selected) {
        cancel('Update cancelled.');
        return;
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
        const result = await Effect.runPromise(updateOne(platform, args.quiet as boolean));
        results.push(result);
      }
    }

    if (args.json) {
      console.log(JSON.stringify(results, null, 2));
    } else {
      console.log(renderResults(results));
    }
    process.exit(0);
  },
});

function updateOne(
  platform: PlatformHandler,
  quiet: boolean,
): Effect.Effect<PlatformResult, never> {
  return Effect.gen(function* () {
    const prevVersion = yield* platform.getInstalledVersion.pipe(
      Effect.catchCause(() => Effect.succeed('unknown')),
    );

    const spinner = createSpinner(quiet);
    spinner.start(`Updating ${platform.label}...`);

    const errorMessage: string | void = yield* platform.update.pipe(
      Effect.catchTag('CommandError', (error) => Effect.succeed(error.message)),
    );

    if (errorMessage !== undefined) {
      spinner.stop(`Failed: ${errorMessage}`);
      return {
        id: platform.id,
        label: platform.label,
        ok: false,
        message: errorMessage,
      } satisfies PlatformResult;
    }

    const nextVersion = yield* platform.getInstalledVersion.pipe(
      Effect.catchCause(() => Effect.succeed('unknown')),
    );

    spinner.stop(previewVersionDiff(prevVersion, nextVersion));

    return {
      id: platform.id,
      label: platform.label,
      ok: true,
      message: 'Updated',
      prevVersion,
      nextVersion,
    } satisfies PlatformResult;
  });
}

function previewVersionDiff(before: string, after: string): string {
  if (before === 'unknown' && after !== 'unknown') return `Installed v${after}`;
  if (before === after) return `Already up to date (v${before})`;
  return `Updated: v${before} → v${after}`;
}
