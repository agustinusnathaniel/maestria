import { existsSync } from 'node:fs';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import type { ReferenceDraft, Transform } from '@/types.js';
import { RULES_PATH } from '@/root.js';

export const registerReferenceTransforms = (ctx: {
  reference: { transform: Transform<ReferenceDraft> };
}): Effect.Effect<void, never, Scope.Scope> =>
  Effect.gen(function* registerReferenceTransformsEffect() {
    yield* ctx.reference.transform((draft: ReferenceDraft) => {
      if (existsSync(RULES_PATH)) {
        draft.add('maestria.rules', {
          description: 'Maestria global agent rules (synced from @maestria/core)',
          path: RULES_PATH,
          type: 'local',
        });
      }
    });
  });
