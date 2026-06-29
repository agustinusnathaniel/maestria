import picocolors from 'picocolors';
import { defineCommand } from 'citty';
import { Effect } from 'effect';
import { select, isCancel, cancel } from '@clack/prompts';
import { platforms, getPlatform } from '@/lib/platforms.js';
import type { PlatformHandler } from '@/lib/platforms.js';
import { detectInstalled } from '@/lib/detect.js';
import { invalidateVersionCache } from '@/lib/shell.js';
import { createSpinner, renderResults, renderCompactResults } from '@/lib/output.js';
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
      description:
        'Platform to update. One of: opencode, pi, kimi-code. Pass directly to skip interactive selection.',
      required: false,
    },
    version: {
      type: 'string',
      description: 'Target version to install (e.g., 0.5.0). Defaults to latest available version.',
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
      description:
        'Output results as JSON — structured machine-readable format optimized for AI agents and CI pipelines',
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
        process.exit(1);
      }

      const result = await Effect.runPromise(
        updateOne(platform, isQuiet, args.version as string | undefined),
      );
      results.push(result);
    } else if (args.all) {
      const spinner = createSpinner(isQuiet);
      spinner.start('Detecting platforms...');
      const installed = await Effect.runPromise(detectInstalled());
      spinner.stop('Done');

      if (installed.length === 0) {
        console.log('No maestria installations found to update.');
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
        const result = await Effect.runPromise(
          updateOne(platform, isQuiet, args.version as string | undefined),
        );
        results.push(result);
      }
    } else {
      // Non-TTY guard: don't try interactive prompts
      if (!process.stdout.isTTY || !process.stdin.isTTY) {
        console.error('No platform specified and not in an interactive terminal.');
        console.error('Usage: maestria update <platform> or maestria update --all');
        console.error("Run 'maestria update --help' for details.");
        process.exit(1);
      }

      // Interactive — check versions before showing picker
      const installed = await Effect.runPromise(detectInstalled());

      if (installed.length === 0) {
        console.log('No maestria installations found to update.');
        process.exit(0);
      }

      // Check which platforms actually need updating
      const statuses: Array<{
        id: string;
        label: string;
        installedVersion: string;
        latestVersion: string;
        needsUpdate: boolean;
      }> = [];
      for (const p of installed) {
        const platform = getPlatform(p.id);
        if (!platform) continue;

        const prevVersion = platform.getInstalledVersion.pipe(
          Effect.catchCause(() => Effect.succeed('unknown')),
        );
        const latestVersion = platform.getLatestVersion.pipe(
          Effect.catchCause(() => Effect.succeed('unknown')),
        );
        const [pv, lv] = await Effect.runPromise(
          Effect.all([prevVersion, latestVersion], { concurrency: 2 }),
        );

        statuses.push({
          id: p.id,
          label: p.label,
          installedVersion: pv,
          latestVersion: lv,
          needsUpdate: pv !== 'unknown' && lv !== 'unknown' && pv !== lv,
        });
      }

      const needsUpdate = statuses.filter((s) => s.needsUpdate);
      const upToDate = statuses.filter((s) => !s.needsUpdate);

      if (needsUpdate.length === 0) {
        const lines = upToDate
          .map((s) => `  ${picocolors.green('✓')} ${s.label}: ${s.installedVersion}`)
          .join('\n');
        console.log(`\nAll platforms are up to date.\n${lines}\n`);
        process.exit(0);
      }

      // Only show platforms that need updating
      const selected = await select({
        message: 'Which platform do you want to update?',
        options: needsUpdate.map((s) => ({
          value: s.id,
          label: s.label,
          hint: `${s.installedVersion} → ${s.latestVersion}`,
        })),
      });

      if (isCancel(selected) || !selected) {
        cancel('Update cancelled.');
        process.exit(130);
      }

      const platform = getPlatform(String(selected))!;
      const result = await Effect.runPromise(
        updateOne(platform, isQuiet, args.version as string | undefined),
      );
      results.push(result);
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

    // Skip if already on the target version
    if (prevVersion !== 'unknown' && prevVersion === targetVersion) {
      return {
        id: platform.id,
        label: platform.label,
        ok: true,
        message: 'Already up to date',
        prevVersion,
        nextVersion: prevVersion,
      } satisfies PlatformResult;
    }

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
