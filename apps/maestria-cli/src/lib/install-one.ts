import { Effect } from 'effect';
import { createSpinner } from './output.js';
import type { PlatformHandler } from './platforms.js';
import type { PlatformResult } from '../types.js';
import { CommandError } from './shell.js';

export function installOne(
  platform: PlatformHandler,
  quiet: boolean,
): Effect.Effect<PlatformResult, never> {
  return Effect.gen(function* () {
    const spinner = createSpinner(quiet);
    spinner.start(`Installing ${platform.label}...`);
    yield* platform.install;
    spinner.stop('Installed');
    return {
      id: platform.id,
      label: platform.label,
      ok: true,
      message: 'Installed',
    } satisfies PlatformResult;
  }).pipe(
    Effect.catchTag('CommandError', (error: CommandError) =>
      Effect.succeed({
        id: platform.id,
        label: platform.label,
        ok: false,
        message: error.message,
      } satisfies PlatformResult),
    ),
  );
}
