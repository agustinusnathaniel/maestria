import { Effect } from 'effect';

import { createSpinner } from '@/lib/output.js';
import type { PlatformHandler, PlatformUpdateSnapshot } from '@/lib/platforms.js';
import { invalidateVersionCache } from '@/lib/shell.js';
import type { CommandError } from '@/lib/shell.js';
import { isVersionEq, isVersionGt } from '@/lib/version.js';
import type { PlatformResult } from '@/types.js';

const runLifecycleTransaction = (
  platform: PlatformHandler,
  quiet: boolean,
  gerund: string,
  completed: string,
  operation: Effect.Effect<void, CommandError>,
): Effect.Effect<PlatformResult> =>
  Effect.gen(function* runLifecycleTransactionEffect() {
    const spinner = createSpinner(quiet);
    spinner.start(`${gerund} ${platform.label}...`);

    const errorMessage: string | null = yield* operation.pipe(
      Effect.as(null),
      Effect.catchTag('CommandError', (error) => Effect.succeed(error.message)),
    );

    if (errorMessage === null) {
      spinner.stop(completed);
      return {
        id: platform.id,
        label: platform.label,
        message: completed,
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

export const installOne = (
  platform: PlatformHandler,
  quiet: boolean,
): Effect.Effect<PlatformResult> =>
  runLifecycleTransaction(platform, quiet, 'Installing', 'Installed', platform.install);

export const uninstallOne = (
  platform: PlatformHandler,
  quiet: boolean,
): Effect.Effect<PlatformResult> =>
  runLifecycleTransaction(platform, quiet, 'Uninstalling', 'Uninstalled', platform.uninstall);

const previewVersionDiff = (before: string, after: string): string => {
  if (before === 'unknown' && after !== 'unknown') {
    return `Installed v${after}`;
  }
  if (before === after) {
    return `Already up to date (v${before})`;
  }
  return `Updated: v${before} → v${after}`;
};

const isSpecified = (value: string | null | undefined): value is string =>
  value !== undefined && value !== null && value !== '';

const captureSnapshot = (
  platform: PlatformHandler,
): Effect.Effect<PlatformUpdateSnapshot | { error: string } | null> => {
  if (!platform.captureUpdateSnapshot) {
    return Effect.succeed(null);
  }
  return platform.captureUpdateSnapshot.pipe(
    Effect.match({
      onFailure: (error) => ({ error: error.message }),
      onSuccess: (s) => s,
    }),
  );
};

// oxlint-disable-next-line max-lines-per-function -- updateOne orchestrates the per-platform update transaction (snapshot capture, version checks, preflight, downgrade guard, spinner, cache invalidation) as a single atomic flow; splitting would obscure the sequential transaction and create single-use helpers.
export const updateOne = (
  platform: PlatformHandler,
  quiet: boolean,
  version?: string,
): Effect.Effect<PlatformResult> =>
  // oxlint-disable-next-line max-lines-per-function -- Effect.gen generator implements the same atomic update transaction as updateOne; splitting the generator would duplicate snapshot/version/preflight closure and hide the linear flow.
  Effect.gen(function* updateOneEffect() {
    if (isSpecified(version) && platform.supportsVersionPinning === false) {
      return {
        id: platform.id,
        label: platform.label,
        message: `Version pinning is not supported for ${platform.label}; updating without --version is required.`,
        ok: false,
      } satisfies PlatformResult;
    }
    const captured = yield* captureSnapshot(platform);
    if (captured !== null && 'error' in captured) {
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
      const preflightError: string | null = yield* platform
        .preflightUpdate(snapshot ?? undefined)
        .pipe(
          Effect.as(null),
          Effect.catchTag('CommandError', (error) => Effect.succeed(error.message)),
        );
      if (preflightError !== null) {
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
    if (!isSpecified(version) && isVersionGt(prevVersion, targetVersion)) {
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
    const errorMessage: string | null = yield* platform.update(version, snapshot ?? undefined).pipe(
      Effect.as(null),
      Effect.catchTag('CommandError', (error) => Effect.succeed(error.message)),
    );
    if (errorMessage !== null) {
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
    if (isSpecified(platform.npmPackage)) {
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
