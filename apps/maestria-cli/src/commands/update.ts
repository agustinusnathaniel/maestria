import { defineCommand } from 'citty';
import { Effect } from 'effect';
import { select, isCancel, cancel } from '@clack/prompts';
import { platforms, getPlatform } from '../lib/platforms.js';
import type { PlatformHandler } from '../lib/platforms.js';
import { detectInstalled, detectAll } from '../lib/detect.js';
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
      const installed = await Effect.runPromise(detectInstalled());

      if (installed.length === 0) {
        console.log('No maestria installations found to update.');
        return;
      }

      for (const p of installed) {
        const platform = getPlatform(p.id)!;
        const result = await Effect.runPromise(updateOne(platform, args.quiet as boolean));
        results.push(result);
      }
    } else {
      const installed = await Effect.runPromise(detectInstalled());

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

      const platform = getPlatform(String(selected))!;
      const result = await Effect.runPromise(updateOne(platform, args.quiet as boolean));
      results.push(result);
    }

    if (args.json) {
      console.log(JSON.stringify(results, null, 2));
    } else {
      console.log(renderResults(results));
    }
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

    yield* platform.update;

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
  }).pipe(
    Effect.catchTag('CommandError', (error) =>
      Effect.succeed({
        id: platform.id,
        label: platform.label,
        ok: false,
        message: error.message,
        prevVersion: undefined,
        nextVersion: undefined,
      } satisfies PlatformResult),
    ),
  );
}

function previewVersionDiff(before: string, after: string): string {
  if (before === 'unknown' && after !== 'unknown') return `Installed v${after}`;
  if (before === after) return `Already up to date (v${before})`;
  return `Updated: v${before} → v${after}`;
}
