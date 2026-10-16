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
  operation: Effect.Effect<unknown, CommandError>,
): Effect.Effect<PlatformResult> =>
  Effect.gen(function* runLifecycleTransactionEffect() {
    const spinner = createSpinner(quiet);
    spinner.start(`${gerund} ${platform.label}...`);

    const result = yield* operation.pipe(
      Effect.match({
        onFailure: (error) => ({ message: error.message, ok: false }),
        onSuccess: (value) => ({
          message: typeof value === 'string' ? value : completed,
          ok: true,
        }),
      }),
    );
    if (result.ok) {
      spinner.stop(result.message);
    } else {
      spinner.error(`Failed: ${result.message}`);
    }
    return {
      id: platform.id,
      label: platform.label,
      ...result,
    } satisfies PlatformResult;
  });

export const installOne = (
  platform: PlatformHandler,
  quiet: boolean,
): Effect.Effect<PlatformResult> =>
  runLifecycleTransaction(platform, quiet, 'Installing', 'Installed', platform.install);

/**
 * Host uninstallers disagree on a missing package, so a failure counts as success when maestria
 * is not installed. The host still runs first: its install probes report absent when they fail.
 */
export const uninstallOne = (
  platform: PlatformHandler,
  quiet: boolean,
): Effect.Effect<PlatformResult> =>
  runLifecycleTransaction(
    platform,
    quiet,
    'Uninstalling',
    'Uninstalled',
    platform.uninstall.pipe(
      Effect.catchTag('CommandError', (failure) =>
        platform.isInstalled.pipe(
          Effect.flatMap((installed) =>
            installed ? Effect.fail(failure) : Effect.succeed('Not installed'),
          ),
        ),
      ),
    ),
  );

const previewVersionDiff = (ref: string, before: string, after: string): string => {
  if (before === 'unknown' && after !== 'unknown') {
    return `Installed ${ref} v${after}`;
  }
  if (before === after) {
    return `Already up to date (${ref} v${before})`;
  }
  return `Updated ${ref}: v${before} → v${after}`;
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

// oxlint-disable-next-line max-lines-per-function -- atomic per-platform update flow, keep intact.
export const updateOne = (
  platform: PlatformHandler,
  quiet: boolean,
  version?: string,
): Effect.Effect<PlatformResult> =>
  // oxlint-disable-next-line max-lines-per-function -- shares the transaction closure above.
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
          Effect.catchEager(() => Effect.succeed('unknown')),
        );
    const targetVersion = version ?? (yield* platform.getLatestVersion);
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
    // Hermes has no package: keep its label.
    const packageRef = platform.npmPackage ?? platform.label;
    spinner.start(`Updating ${packageRef}: ${prevVersion} → ${targetVersion}...`);
    const errorMessage: string | null = yield* platform.update(version, snapshot ?? undefined).pipe(
      Effect.as(null),
      Effect.catchTag('CommandError', (error) => Effect.succeed(error.message)),
    );
    if (errorMessage !== null) {
      spinner.error(`Failed: ${errorMessage}`);
      return {
        id: platform.id,
        label: platform.label,
        message: errorMessage,
        ok: false,
      } satisfies PlatformResult;
    }
    const nextVersion = yield* platform.getInstalledVersion.pipe(
      Effect.catchEager(() => Effect.succeed('unknown')),
    );
    spinner.stop(previewVersionDiff(packageRef, prevVersion, nextVersion));
    if (isSpecified(platform.npmPackage)) {
      yield* invalidateVersionCache(platform.npmPackage);
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
