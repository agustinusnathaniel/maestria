import { Effect } from 'effect';

import { createSpinner } from '@/lib/output.js';
import type { PlatformHandler } from '@/lib/platforms.js';
import type { PlatformResult } from '@/types.js';

export const installOne = (
  platform: PlatformHandler,
  quiet: boolean,
): Effect.Effect<PlatformResult> =>
  Effect.gen(function* installOneEffect() {
    const spinner = createSpinner(quiet);
    spinner.start(`Installing ${platform.label}...`);

    // On success, result is void.
    // On CommandError, catchTag replaces it with the error message string.
    const errorMessage: string | null = yield* platform.install.pipe(
      Effect.as(null),
      Effect.catchTag('CommandError', (error) => Effect.succeed(error.message)),
    );

    if (errorMessage === null) {
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
