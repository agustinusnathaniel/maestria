import { isCancel, cancel } from '@clack/prompts';
import { defineCommand } from 'citty';
import { Effect } from 'effect';
import picocolors from 'picocolors';

import { detectInstalled } from '@/lib/detect.js';
import { needsUpdateOf } from '@/lib/freshness.js';
import { groupMultiselect } from '@/lib/group-multiselect.js';
import { createSpinner, renderResults, renderCompactResults } from '@/lib/output.js';
import { getPlatform } from '@/lib/platforms.js';
import type { PlatformHandler, PlatformUpdateSnapshot } from '@/lib/platforms.js';
import { exitCodeForResults } from '@/lib/result-exit.js';
import { invalidateVersionCache } from '@/lib/shell.js';
import {
  validatePlatforms,
  validateVersion,
  validateOrExit,
  VALID_PLATFORMS,
} from '@/lib/validation.js';
import { isVersionEq, isVersionGt } from '@/lib/version.js';
import type { PlatformResult } from '@/types.js';

async function runDirectUpdate(
  platformIds: string[],
  isQuiet: boolean,
  version?: string,
): Promise<PlatformResult[]> {
  const results: PlatformResult[] = [];
  for (const id of platformIds) {
    const platform = getPlatform(id);
    if (!platform) {
      results.push({
        id,
        label: id,
        message: 'Platform definition not found. This is a bug.',
        ok: false,
      } satisfies PlatformResult);
      continue;
    }
    results.push(await Effect.runPromise(updateOne(platform, isQuiet, version)));
  }
  return results;
}

async function runAllUpdate(isQuiet: boolean, version?: string): Promise<PlatformResult[]> {
  const spinner = createSpinner(isQuiet);
  spinner.start('Detecting platforms...');
  const installed = await Effect.runPromise(detectInstalled());
  spinner.stop('Done');
  if (installed.length === 0) {
    console.log('No maestria installations found to update.');
    process.exit(0);
  }
  const results: PlatformResult[] = [];
  for (const p of installed) {
    const platform = getPlatform(p.id);
    if (!platform) {
      results.push({
        id: p.id,
        label: p.label,
        message: 'Platform definition not found. This is a bug.',
        ok: false,
      } satisfies PlatformResult);
      continue;
    }
    results.push(await Effect.runPromise(updateOne(platform, isQuiet, version)));
  }
  return results;
}

// oxlint-disable-next-line max-lines-per-function -- runInteractiveUpdate orchestrates the interactive update picker (version checks, needsUpdate filtering, groupMultiselect) as a single cohesive flow; splitting would fragment the picker's state (statuses/needsUpdate) and duplicate version-check logic.
async function runInteractiveUpdate(isQuiet: boolean, version?: string): Promise<PlatformResult[]> {
  if (!process.stdout.isTTY || !process.stdin.isTTY) {
    console.error('No platform specified and not in an interactive terminal.');
    console.error('Usage: maestria update <platform> or maestria update --all');
    console.error("Run 'maestria update --help' for details.");
    process.exit(1);
  }
  const installed = await Effect.runPromise(detectInstalled());
  if (installed.length === 0) {
    console.log('No maestria installations found to update.');
    process.exit(0);
  }
  const statuses: {
    id: string;
    label: string;
    installedVersion: string;
    latestVersion: string;
    needsUpdate: boolean;
  }[] = [];
  for (const p of installed) {
    const platform = getPlatform(p.id);
    if (!platform) {
      continue;
    }
    const [pv, lv] = await Effect.runPromise(
      Effect.all(
        [
          platform.getInstalledVersion.pipe(Effect.catchCause(() => Effect.succeed('unknown'))),
          platform.getLatestVersion.pipe(Effect.catchCause(() => Effect.succeed('unknown'))),
        ],
        { concurrency: 2 },
      ),
    );
    statuses.push({
      id: p.id,
      installedVersion: pv,
      label: p.label,
      latestVersion: lv,
      needsUpdate: needsUpdateOf(pv, lv),
    });
  }
  const needsUpdate = statuses.filter((s) => s.needsUpdate);
  if (needsUpdate.length === 0) {
    const lines = statuses
      .filter((s) => !s.needsUpdate)
      .map((s) => `  ${picocolors.green('✓')} ${s.label}: ${s.installedVersion}`)
      .join('\n');
    console.log(`\nAll platforms are up to date.\n${lines}\n`);
    process.exit(0);
  }
  const selected = await groupMultiselect({
    message: 'Which platforms do you want to update?',
    options: {
      'All platforms': needsUpdate.map((s) => ({
        hint: `${s.installedVersion} → ${s.latestVersion}`,
        label: s.label,
        value: s.id,
      })),
    },
    required: true,
    selectableGroups: true,
  });
  if (
    isCancel(selected) ||
    selected === undefined ||
    selected === null ||
    (selected as unknown) === '' ||
    (Array.isArray(selected) && selected.length === 0)
  ) {
    cancel('Update cancelled.');
    process.exit(130);
  }
  const toUpdate = needsUpdate.filter((s) => selected.includes(s.id));
  const results: PlatformResult[] = [];
  for (const p of toUpdate) {
    // oxlint-disable-next-line typescript/no-non-null-assertion -- SAFETY: filtered needsUpdate guarantees platform exists for id
    results.push(await Effect.runPromise(updateOne(getPlatform(p.id)!, isQuiet, version)));
  }
  return results;
}

export const updateCommand = defineCommand({
  args: {
    all: {
      alias: 'a',
      default: false,
      description: 'Update all installed platforms',
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
      description: `Platform(s) to update. Comma-separated for multiple (e.g., opencode,pi). One of: ${VALID_PLATFORMS.join(', ')}. Pass directly to skip interactive selection.`,
      required: false,
      type: 'positional',
    },
    quiet: {
      default: false,
      description:
        'Suppress spinner and non-essential output. Recommended for CI and non-interactive usage.',
      type: 'boolean',
    },
    version: {
      alias: 'V',
      description: 'Target version to install (e.g., 0.5.0). Defaults to latest available version.',
      required: false,
      type: 'string',
    },
  },
  meta: {
    description: 'Update maestria plugins to the latest (or specified) version',
    name: 'update',
  },
  run: async ({ args }) => {
    const isQuiet = args.quiet || args.compact;
    const isCompact = args.compact;
    let platformIds: string[] | undefined;
    if (args.platform !== undefined && args.platform !== null && args.platform !== '') {
      platformIds = await validateOrExit(validatePlatforms(args.platform));
    }
    if (args.version !== undefined && args.version !== null && args.version !== '') {
      await validateOrExit(validateVersion(args.version));
    }
    const results: PlatformResult[] = [];
    if (platformIds && platformIds.length > 0) {
      results.push(...(await runDirectUpdate(platformIds, isQuiet, args.version)));
    } else if (args.all) {
      results.push(...(await runAllUpdate(isQuiet, args.version)));
    } else {
      results.push(...(await runInteractiveUpdate(isQuiet, args.version)));
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

function previewVersionDiff(before: string, after: string): string {
  if (before === 'unknown' && after !== 'unknown') {
    return `Installed v${after}`;
  }
  if (before === after) {
    return `Already up to date (v${before})`;
  }
  return `Updated: v${before} → v${after}`;
}

function captureSnapshot(
  platform: PlatformHandler,
): Effect.Effect<PlatformUpdateSnapshot | { error: string } | undefined> {
  if (!platform.captureUpdateSnapshot) {
    return Effect.succeed(undefined);
  }
  return platform.captureUpdateSnapshot.pipe(
    Effect.match({
      onFailure: (error) => ({ error: error.message }),
      onSuccess: (s) => s,
    }),
  );
}

// oxlint-disable-next-line max-lines-per-function -- updateOne orchestrates the per-platform update transaction (snapshot capture, version checks, preflight, downgrade guard, spinner, cache invalidation) as a single atomic flow; splitting would obscure the sequential transaction and create single-use helpers.
export function updateOne(
  platform: PlatformHandler,
  quiet: boolean,
  version?: string,
): Effect.Effect<PlatformResult> {
  // oxlint-disable-next-line max-lines-per-function -- Effect.gen generator implements the same atomic update transaction as updateOne; splitting the generator would duplicate snapshot/version/preflight closure and hide the linear flow.
  return Effect.gen(function* () {
    if (
      version !== undefined &&
      version !== null &&
      version !== '' &&
      platform.supportsVersionPinning === false
    ) {
      return {
        id: platform.id,
        label: platform.label,
        message: `Version pinning is not supported for ${platform.label}; updating without --version is required.`,
        ok: false,
      } satisfies PlatformResult;
    }
    const captured = yield* captureSnapshot(platform);
    if (captured !== undefined && 'error' in captured) {
      return {
        id: platform.id,
        label: platform.label,
        message: captured.error,
        ok: false,
      } satisfies PlatformResult;
    }
    const snapshot = captured;
    const prevVersion = snapshot
      ? snapshot.installedVersion
      : yield* platform.getInstalledVersion.pipe(
          Effect.catchCause(() => Effect.succeed('unknown')),
        );
    const targetVersion =
      version ??
      (yield* platform.getLatestVersion.pipe(Effect.catchCause(() => Effect.succeed('latest'))));
    if (platform.preflightUpdate) {
      const preflightError: string | void = yield* platform
        .preflightUpdate(snapshot)
        .pipe(Effect.catchTag('CommandError', (error) => Effect.succeed(error.message)));
      if (preflightError !== undefined) {
        return {
          id: platform.id,
          label: platform.label,
          message: preflightError,
          ok: false,
        } satisfies PlatformResult;
      }
    }
    if (isVersionEq(prevVersion, targetVersion)) {
      return {
        id: platform.id,
        label: platform.label,
        message: 'Already up to date',
        nextVersion: prevVersion,
        ok: true,
        prevVersion,
      } satisfies PlatformResult;
    }
    if (
      (version === undefined || version === null || version === '') &&
      isVersionGt(prevVersion, targetVersion)
    ) {
      return {
        id: platform.id,
        label: platform.label,
        message: `Installed v${prevVersion} is newer than latest v${targetVersion}; skipping (use --version to pin)`,
        nextVersion: prevVersion,
        ok: true,
        prevVersion,
      } satisfies PlatformResult;
    }
    const spinner = createSpinner(quiet);
    spinner.start(`Updating ${platform.label}: ${prevVersion} → ${targetVersion}...`);
    const errorMessage: string | void = yield* platform
      .update(version, snapshot)
      .pipe(Effect.catchTag('CommandError', (error) => Effect.succeed(error.message)));
    if (errorMessage !== undefined) {
      spinner.stop(`Failed: ${errorMessage}`);
      return {
        id: platform.id,
        label: platform.label,
        message: errorMessage,
        ok: false,
      } satisfies PlatformResult;
    }
    const nextVersion = yield* platform.getInstalledVersion.pipe(
      Effect.catchCause(() => Effect.succeed('unknown')),
    );
    spinner.stop(previewVersionDiff(prevVersion, nextVersion));
    if (
      platform.npmPackage !== undefined &&
      platform.npmPackage !== null &&
      platform.npmPackage !== ''
    ) {
      yield* invalidateVersionCache(platform.npmPackage).pipe(Effect.catchCause(() => Effect.void));
    }
    return {
      id: platform.id,
      label: platform.label,
      message: 'Updated',
      nextVersion,
      ok: true,
      prevVersion,
    } satisfies PlatformResult;
  });
}
