import { defineCommand } from 'citty';
import { Effect } from 'effect';
import { select, isCancel, cancel } from '@clack/prompts';
import { platforms, getPlatform } from '@/lib/platforms.js';
import type { PlatformHandler } from '@/lib/platforms.js';
import { detectInstalled } from '@/lib/detect.js';
import { invalidateVersionCache } from '@/lib/shell.js';
import { createSpinner, renderResults } from '@/lib/output.js';
import {
  validatePlatform,
  validateVersion,
  validateNotAllAndPlatform,
  validateOrExit,
} from '@/lib/validation.js';
import type { PlatformResult } from '@/types.js';

export const updateCommand = defineCommand({
  meta: {
    name: 'update',
    description: 'Update maestria plugins to the latest (or specified) version',
  },
  args: {
    platform: {
      type: 'positional',
      description: 'Platform to update. Omit for interactive selection.',
      required: false,
    },
    version: {
      type: 'string',
      description: 'Specific version to install (e.g., 0.5.0). Defaults to latest.',
      alias: 'V',
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
    // Validate CLI args
    if (args.platform) {
      await validateOrExit(validatePlatform(args.platform as string));
    }
    if (args.version) {
      await validateOrExit(validateVersion(args.version as string));
    }
    await validateOrExit(
      validateNotAllAndPlatform(args.all as boolean, args.platform as string | undefined),
    );

    const results: PlatformResult[] = [];

    if (args.platform) {
      const platform = getPlatform(args.platform as string);
      if (!platform) {
        console.error(`Unknown platform: ${args.platform}`);
        console.error(`Available: ${platforms.map((p) => p.id).join(', ')}`);
        return;
      }

      const result = await Effect.runPromise(
        updateOne(platform, args.quiet as boolean, args.version as string | undefined),
      );
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
        const result = await Effect.runPromise(
          updateOne(platform, args.quiet as boolean, args.version as string | undefined),
        );
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
        const result = await Effect.runPromise(
          updateOne(platform, args.quiet as boolean, args.version as string | undefined),
        );
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
  version?: string,
): Effect.Effect<PlatformResult, never> {
  return Effect.gen(function* () {
    const prevVersion = yield* platform.getInstalledVersion.pipe(
      Effect.catchCause(() => Effect.succeed('unknown')),
    );

    // Determine target version: explicit arg, or fetch latest from npm
    const targetVersion =
      version ??
      (yield* platform.getLatestVersion.pipe(Effect.catchCause(() => Effect.succeed('latest'))));

    const spinner = createSpinner(quiet);
    spinner.start(`Updating ${platform.label}: ${prevVersion} → ${targetVersion}...`);

    const errorMessage: string | void = yield* platform
      .update(version)
      .pipe(Effect.catchTag('CommandError', (error) => Effect.succeed(error.message)));

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

    // Invalidate version cache so next status sees the correct latest version
    if (platform.npmPackage) {
      yield* invalidateVersionCache(platform.npmPackage).pipe(Effect.catchCause(() => Effect.void));
    }

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
