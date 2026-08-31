import { Effect } from 'effect';

import { createSpinner } from '@/lib/output.js';
import type { PlatformHandler } from '@/lib/platforms.js';
import type { PlatformResult } from '@/types.js';

export function installOne(
  platform: PlatformHandler,
  quiet: boolean,
): Effect.Effect<PlatformResult> {
  return Effect.gen(function* () {
    const spinner = createSpinner(quiet);
    spinner.start(`Installing ${platform.label}...`);

    // On success, result is void.
    // On CommandError, catchTag replaces it with the error message string.
    const errorMessage: string | void = yield* platform.install.pipe(
      Effect.catchTag('CommandError', (error) => Effect.succeed(error.message)),
    );

    if (errorMessage === undefined) {
      spinner.stop('Installed');
      return {
        id: platform.id,
        label: platform.label,
        message: 'Installed',
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
}
