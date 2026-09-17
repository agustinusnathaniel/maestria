import { Effect } from 'effect';

import { commandExists, run } from '@/lib/shell.js';

/**
 * Probe for a Cursor CLI binary.
 *
 * Returns `'cursor-agent'` when present, `'agent'` when the `agent` binary
 * reports itself as Cursor, and `undefined` when neither is usable. Used by
 * platform detection and per-agent model configuration so both agree on which
 * binary to call.
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
