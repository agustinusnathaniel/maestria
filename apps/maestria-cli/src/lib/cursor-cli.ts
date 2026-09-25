import { Effect } from 'effect';

import { commandExists, run } from '@/lib/shell.js';

/**
 * Probe for a Cursor CLI binary: `'cursor-agent'` when present, `'agent'`
 * when that binary reports itself as Cursor, else `undefined`. Shared by
 * detection and model configuration so both agree on the binary to call.
 */
export const cursorCliName = (): Effect.Effect<string | undefined> =>
  Effect.gen(function* cursorCliNameEffect() {
    let cliName: string | undefined;
    if (yield* commandExists('cursor-agent')) {
      cliName = 'cursor-agent';
    } else if (yield* commandExists('agent')) {
      const version = yield* run('agent', ['--version'], 3000).pipe(
        Effect.catchCause(() => Effect.succeed('')),
      );
      if (/cursor/iu.test(version)) {
        cliName = 'agent';
      }
    }
    return cliName;
  });
