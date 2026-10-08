import { existsSync } from 'node:fs';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import type { ReferenceEditor, Transform } from '@/types.js';
import { RULES_PATH } from '@/root.js';

export const registerReferenceTransforms = (ctx: {
  reference: { transform: Transform<ReferenceEditor> };
}): Effect.Effect<void, never, Scope.Scope> =>
  Effect.gen(function* registerReferenceTransformsEffect() {
    yield* ctx.reference.transform((draft: ReferenceEditor) => {
      if (existsSync(RULES_PATH)) {
        draft.add('maestria.rules', {
          path: RULES_PATH,
          type: 'local',
        });
      }
    });
  });
